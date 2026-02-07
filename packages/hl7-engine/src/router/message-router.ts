/**
 * HL7v2 Message Router
 *
 * Routes parsed HL7v2 messages to registered handlers based on
 * message type and trigger event. Supports dead letter queue for
 * unroutable or failed messages, and comprehensive logging.
 */

import { HL7Message } from '../parser/types';
import { buildACK, AckCode } from '../messages/ack';
import { HL7Parser } from '../parser/hl7-parser';
import { createLogger } from '../logger';

/** Result of processing a message */
export interface ProcessingResult {
  /** Whether processing was successful */
  success: boolean;
  /** Acknowledgment code to send back */
  ackCode: AckCode;
  /** Error message if processing failed */
  errorMessage?: string;
  /** Optional data returned by the handler */
  data?: unknown;
}

/** Message handler function type */
export type MessageHandler = (message: HL7Message) => Promise<ProcessingResult>;

/** Dead letter queue entry */
export interface DeadLetterEntry {
  /** The message that could not be processed */
  message: HL7Message;
  /** Reason the message ended up in the dead letter queue */
  reason: string;
  /** Timestamp when the message was added to the DLQ */
  timestamp: Date;
  /** Number of processing attempts */
  attempts: number;
  /** Last error encountered */
  lastError?: string;
}

/** Handler registration entry */
interface HandlerEntry {
  /** Message type (e.g., 'ADT') */
  messageType: string;
  /** Trigger event (e.g., 'A01') or '*' for all triggers of this type */
  triggerEvent: string;
  /** Handler function */
  handler: MessageHandler;
}

export class MessageRouter {
  private handlers: HandlerEntry[] = [];
  private deadLetterQueue: DeadLetterEntry[] = [];
  private maxDeadLetterSize: number;
  private logger = createLogger('MessageRouter');
  private parser: HL7Parser;

  /**
   * Create a new message router.
   *
   * @param options - Router configuration
   */
  constructor(options: { maxDeadLetterSize?: number } = {}) {
    this.maxDeadLetterSize = options.maxDeadLetterSize || 1000;
    this.parser = new HL7Parser();
  }

  /**
   * Register a handler for a specific message type and trigger event.
   *
   * @param messageType - HL7 message type (e.g., 'ADT', 'ORM', 'ORU')
   * @param triggerEvent - Trigger event (e.g., 'A01', 'O01') or '*' for all triggers
   * @param handler - Async handler function
   */
  registerHandler(
    messageType: string,
    triggerEvent: string,
    handler: MessageHandler
  ): void {
    this.handlers.push({
      messageType: messageType.toUpperCase(),
      triggerEvent: triggerEvent.toUpperCase(),
      handler,
    });

    this.logger.info(
      `Registered handler for ${messageType}^${triggerEvent}`
    );
  }

  /**
   * Remove all handlers for a specific message type and trigger event.
   *
   * @param messageType - HL7 message type
   * @param triggerEvent - Trigger event
   */
  removeHandler(messageType: string, triggerEvent: string): void {
    const before = this.handlers.length;
    this.handlers = this.handlers.filter(
      (h) =>
        !(
          h.messageType === messageType.toUpperCase() &&
          h.triggerEvent === triggerEvent.toUpperCase()
        )
    );
    const removed = before - this.handlers.length;
    this.logger.info(
      `Removed ${removed} handler(s) for ${messageType}^${triggerEvent}`
    );
  }

  /**
   * Route a message to the appropriate handler and return an ACK.
   *
   * Looks up the handler based on message type and trigger event.
   * If no exact match is found, falls back to wildcard handlers.
   * If no handler is found at all, the message goes to the dead letter queue.
   *
   * @param message - Parsed HL7Message to route
   * @returns Promise resolving to an ACK message (as HL7Message) built from the handler result
   */
  async route(message: HL7Message): Promise<HL7Message> {
    const messageType = message.header.messageType;
    const parts = messageType.split('^');
    const type = (parts[0] || '').toUpperCase();
    const trigger = (parts[1] || '').toUpperCase();

    this.logger.info(
      `Routing message ${type}^${trigger} (ID: ${message.header.messageControlId})`
    );

    // Find matching handler: exact match first, then wildcard
    const handler = this.findHandler(type, trigger);

    if (!handler) {
      this.logger.warn(
        `No handler registered for ${type}^${trigger}`
      );

      // Add to dead letter queue
      this.addToDeadLetterQueue(message, `No handler registered for ${type}^${trigger}`);

      // Return AR (Application Reject) ACK
      const ackStr = buildACK(message, 'AR', `No handler registered for message type ${type}^${trigger}`);
      return this.parser.parse(ackStr);
    }

    try {
      const result = await handler.handler(message);

      this.logger.info(
        `Message ${type}^${trigger} (ID: ${message.header.messageControlId}) ` +
          `processed with result: ${result.ackCode}`
      );

      if (!result.success) {
        this.logger.error(
          `Handler returned error for ${type}^${trigger}: ${result.errorMessage}`
        );
      }

      // Build ACK response
      const ackStr = buildACK(message, result.ackCode, result.errorMessage);
      return this.parser.parse(ackStr);
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));

      this.logger.error(
        `Handler threw exception for ${type}^${trigger}: ${error.message}`
      );

      // Add to dead letter queue
      this.addToDeadLetterQueue(
        message,
        `Handler exception: ${error.message}`,
        error.message
      );

      // Return AE (Application Error) ACK
      const ackStr = buildACK(message, 'AE', `Internal processing error: ${error.message}`);
      return this.parser.parse(ackStr);
    }
  }

  /**
   * Find the best matching handler for a message type and trigger.
   * First looks for an exact match, then falls back to wildcard.
   */
  private findHandler(type: string, trigger: string): HandlerEntry | undefined {
    // Look for exact match
    const exactMatch = this.handlers.find(
      (h) => h.messageType === type && h.triggerEvent === trigger
    );
    if (exactMatch) return exactMatch;

    // Look for wildcard match (handler for all triggers of this type)
    const wildcardMatch = this.handlers.find(
      (h) => h.messageType === type && h.triggerEvent === '*'
    );
    if (wildcardMatch) return wildcardMatch;

    // Look for global wildcard
    const globalWildcard = this.handlers.find(
      (h) => h.messageType === '*' && h.triggerEvent === '*'
    );
    return globalWildcard;
  }

  /**
   * Add a message to the dead letter queue.
   */
  private addToDeadLetterQueue(
    message: HL7Message,
    reason: string,
    lastError?: string
  ): void {
    // Check if message is already in DLQ (by control ID)
    const existing = this.deadLetterQueue.find(
      (entry) => entry.message.header.messageControlId === message.header.messageControlId
    );

    if (existing) {
      existing.attempts++;
      existing.lastError = lastError || reason;
      existing.timestamp = new Date();
    } else {
      // Enforce max size by removing oldest entries
      while (this.deadLetterQueue.length >= this.maxDeadLetterSize) {
        this.deadLetterQueue.shift();
      }

      this.deadLetterQueue.push({
        message,
        reason,
        timestamp: new Date(),
        attempts: 1,
        lastError,
      });
    }

    this.logger.warn(
      `Message ${message.header.messageControlId} added to dead letter queue: ${reason}`
    );
  }

  /**
   * Get all entries in the dead letter queue.
   */
  getDeadLetterQueue(): DeadLetterEntry[] {
    return [...this.deadLetterQueue];
  }

  /**
   * Get the count of messages in the dead letter queue.
   */
  getDeadLetterCount(): number {
    return this.deadLetterQueue.length;
  }

  /**
   * Clear the dead letter queue.
   *
   * @returns The number of entries removed
   */
  clearDeadLetterQueue(): number {
    const count = this.deadLetterQueue.length;
    this.deadLetterQueue = [];
    this.logger.info(`Cleared ${count} entries from dead letter queue`);
    return count;
  }

  /**
   * Retry processing a message from the dead letter queue.
   *
   * @param messageControlId - The control ID of the message to retry
   * @returns Processing result, or null if message not found in DLQ
   */
  async retryDeadLetter(messageControlId: string): Promise<HL7Message | null> {
    const entryIndex = this.deadLetterQueue.findIndex(
      (entry) => entry.message.header.messageControlId === messageControlId
    );

    if (entryIndex === -1) {
      this.logger.warn(`Message ${messageControlId} not found in dead letter queue`);
      return null;
    }

    const entry = this.deadLetterQueue[entryIndex];

    this.logger.info(
      `Retrying dead letter message ${messageControlId} (attempt ${entry.attempts + 1})`
    );

    // Remove from DLQ before retrying (route will re-add if it fails)
    this.deadLetterQueue.splice(entryIndex, 1);

    return this.route(entry.message);
  }

  /**
   * Get a list of all registered handler types.
   */
  getRegisteredHandlers(): Array<{ messageType: string; triggerEvent: string }> {
    return this.handlers.map((h) => ({
      messageType: h.messageType,
      triggerEvent: h.triggerEvent,
    }));
  }
}
