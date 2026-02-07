/**
 * MLLP (Minimum Lower Layer Protocol) Server
 *
 * TCP server that handles HL7v2 message framing using the MLLP protocol.
 * MLLP wraps HL7 messages with:
 *   - Start block: \x0b (vertical tab, VT)
 *   - End block: \x1c\x0d (file separator + carriage return, FS CR)
 *
 * The server parses incoming MLLP-framed messages, emits them as events,
 * and provides a reply callback for sending acknowledgments.
 */

import { EventEmitter } from 'events';
import * as net from 'net';
import { HL7Parser } from '../parser/hl7-parser';
import { HL7Message } from '../parser/types';
import { createLogger } from '../logger';

/** MLLP framing constants */
const MLLP_START_BLOCK = 0x0b; // VT (Vertical Tab)
const MLLP_END_BLOCK = 0x1c; // FS (File Separator)
const MLLP_CARRIAGE_RETURN = 0x0d; // CR (Carriage Return)

/** Connection info for tracking */
interface ConnectionInfo {
  id: string;
  socket: net.Socket;
  remoteAddress: string;
  remotePort: number;
  connectedAt: Date;
  messagesReceived: number;
}

/** Reply callback type for sending responses */
export type ReplyCallback = (responseMessage: string) => void;

/**
 * MLLP Server Events:
 * - 'message': (message: HL7Message, reply: ReplyCallback) - Received a complete HL7 message
 * - 'error': (error: Error) - Server or connection error
 * - 'connection': (info: { remoteAddress: string, remotePort: number }) - New client connection
 * - 'close': (info: { remoteAddress: string, remotePort: number }) - Client disconnected
 */
export class MLLPServer extends EventEmitter {
  private server: net.Server | null = null;
  private connections: Map<string, ConnectionInfo> = new Map();
  private parser: HL7Parser;
  private port: number;
  private host: string;
  private maxConnections: number;
  private idleTimeout: number;
  private connectionCounter: number = 0;
  private logger = createLogger('MLLPServer');

  /**
   * Create a new MLLP server.
   *
   * @param port - TCP port to listen on
   * @param host - Hostname/IP to bind to (default '0.0.0.0')
   * @param options - Additional server options
   */
  constructor(
    port: number,
    host: string = '0.0.0.0',
    options: { maxConnections?: number; idleTimeout?: number } = {}
  ) {
    super();
    this.port = port;
    this.host = host;
    this.parser = new HL7Parser();
    this.maxConnections = options.maxConnections || 100;
    this.idleTimeout = options.idleTimeout || 300000; // 5 minutes default
  }

  /**
   * Start the MLLP server and begin listening for connections.
   *
   * @returns Promise that resolves when the server is listening
   */
  start(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.server = net.createServer((socket) => this.handleConnection(socket));

      this.server.on('error', (err) => {
        this.logger.error('Server error', { error: err.message });
        this.emit('error', err);
        reject(err);
      });

      this.server.listen(this.port, this.host, () => {
        this.logger.info(`MLLP server listening on ${this.host}:${this.port}`);
        resolve();
      });
    });
  }

  /**
   * Gracefully stop the MLLP server.
   * Closes all active connections and stops listening.
   *
   * @returns Promise that resolves when the server is fully stopped
   */
  stop(): Promise<void> {
    return new Promise((resolve) => {
      // Close all active connections
      for (const [id, connInfo] of this.connections) {
        this.logger.info(`Closing connection ${id}`);
        connInfo.socket.destroy();
      }
      this.connections.clear();

      if (this.server) {
        this.server.close(() => {
          this.logger.info('MLLP server stopped');
          this.server = null;
          resolve();
        });
      } else {
        resolve();
      }
    });
  }

  /**
   * Get the number of active connections.
   */
  getConnectionCount(): number {
    return this.connections.size;
  }

  /**
   * Handle a new client connection.
   */
  private handleConnection(socket: net.Socket): void {
    const connId = `conn_${++this.connectionCounter}`;
    const remoteAddress = socket.remoteAddress || 'unknown';
    const remotePort = socket.remotePort || 0;

    // Check max connections
    if (this.connections.size >= this.maxConnections) {
      this.logger.warn(`Max connections (${this.maxConnections}) reached, rejecting ${remoteAddress}:${remotePort}`);
      socket.destroy();
      return;
    }

    const connInfo: ConnectionInfo = {
      id: connId,
      socket,
      remoteAddress,
      remotePort,
      connectedAt: new Date(),
      messagesReceived: 0,
    };

    this.connections.set(connId, connInfo);
    this.logger.info(`New connection ${connId} from ${remoteAddress}:${remotePort}`);
    this.emit('connection', { remoteAddress, remotePort });

    // Set idle timeout
    socket.setTimeout(this.idleTimeout);

    // Buffer for accumulating incoming data
    let buffer = Buffer.alloc(0);

    socket.on('data', (data: Buffer) => {
      // Append incoming data to buffer
      buffer = Buffer.concat([buffer, data]);

      // Process all complete MLLP messages in the buffer
      let startIdx = buffer.indexOf(MLLP_START_BLOCK);

      while (startIdx !== -1) {
        // Look for end block (FS + CR)
        let endIdx = -1;
        for (let i = startIdx + 1; i < buffer.length - 1; i++) {
          if (buffer[i] === MLLP_END_BLOCK && buffer[i + 1] === MLLP_CARRIAGE_RETURN) {
            endIdx = i;
            break;
          }
        }

        if (endIdx === -1) {
          // No complete message yet, wait for more data
          break;
        }

        // Extract the HL7 message (between start and end blocks)
        const messageData = buffer.slice(startIdx + 1, endIdx).toString('utf-8');

        // Remove processed data from buffer
        buffer = buffer.slice(endIdx + 2);

        // Process the message
        this.processMessage(messageData, connInfo, socket);

        // Look for next message
        startIdx = buffer.indexOf(MLLP_START_BLOCK);
      }
    });

    socket.on('timeout', () => {
      this.logger.info(`Connection ${connId} timed out (idle for ${this.idleTimeout}ms)`);
      socket.destroy();
    });

    socket.on('error', (err) => {
      this.logger.error(`Connection ${connId} error`, { error: err.message });
      this.emit('error', err);
    });

    socket.on('close', () => {
      this.connections.delete(connId);
      this.logger.info(`Connection ${connId} closed from ${remoteAddress}:${remotePort}`);
      this.emit('close', { remoteAddress, remotePort });
    });
  }

  /**
   * Process a received HL7 message and emit it as an event.
   */
  private processMessage(
    rawMessage: string,
    connInfo: ConnectionInfo,
    socket: net.Socket
  ): void {
    connInfo.messagesReceived++;

    try {
      const message = this.parser.parse(rawMessage);

      this.logger.info(
        `Received ${message.header.messageType} message (ID: ${message.header.messageControlId}) ` +
          `from ${connInfo.remoteAddress}:${connInfo.remotePort}`
      );

      // Create reply callback that wraps response in MLLP framing
      const reply: ReplyCallback = (responseMessage: string) => {
        const framedResponse = this.wrapInMLLP(responseMessage);
        socket.write(framedResponse);
      };

      this.emit('message', message, reply);
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      this.logger.error(`Failed to parse message from ${connInfo.remoteAddress}:${connInfo.remotePort}`, {
        error: error.message,
      });
      this.emit('error', error);
    }
  }

  /**
   * Wrap an HL7 message string in MLLP framing.
   *
   * @param message - Raw HL7 message string
   * @returns Buffer with MLLP framing (VT + message + FS + CR)
   */
  private wrapInMLLP(message: string): Buffer {
    const messageBuffer = Buffer.from(message, 'utf-8');
    const framed = Buffer.alloc(messageBuffer.length + 3);

    framed[0] = MLLP_START_BLOCK;
    messageBuffer.copy(framed, 1);
    framed[messageBuffer.length + 1] = MLLP_END_BLOCK;
    framed[messageBuffer.length + 2] = MLLP_CARRIAGE_RETURN;

    return framed;
  }
}
