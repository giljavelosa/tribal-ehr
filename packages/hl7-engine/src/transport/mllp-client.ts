/**
 * MLLP (Minimum Lower Layer Protocol) Client
 *
 * TCP client for sending HL7v2 messages using the MLLP protocol.
 * Handles MLLP framing, connection management, response waiting,
 * and automatic retry with exponential backoff.
 */

import * as net from 'net';
import { createLogger } from '../logger';

/** MLLP framing constants */
const MLLP_START_BLOCK = 0x0b; // VT (Vertical Tab)
const MLLP_END_BLOCK = 0x1c; // FS (File Separator)
const MLLP_CARRIAGE_RETURN = 0x0d; // CR (Carriage Return)

/** Default configuration values */
const DEFAULT_RESPONSE_TIMEOUT = 30000; // 30 seconds
const DEFAULT_MAX_RETRIES = 3;
const DEFAULT_BASE_BACKOFF = 1000; // 1 second

/** Client configuration options */
export interface MLLPClientOptions {
  /** Timeout for waiting for a response (ms). Default: 30000 */
  responseTimeout?: number;
  /** Maximum number of retry attempts. Default: 3 */
  maxRetries?: number;
  /** Base backoff time for retries (ms). Default: 1000 */
  baseBackoff?: number;
  /** Connection timeout (ms). Default: 10000 */
  connectTimeout?: number;
}

export class MLLPClient {
  private host: string;
  private port: number;
  private socket: net.Socket | null = null;
  private connected: boolean = false;
  private responseTimeout: number;
  private maxRetries: number;
  private baseBackoff: number;
  private connectTimeout: number;
  private logger = createLogger('MLLPClient');

  /**
   * Create a new MLLP client.
   *
   * @param host - Remote server hostname or IP address
   * @param port - Remote server TCP port
   * @param options - Optional client configuration
   */
  constructor(host: string, port: number, options: MLLPClientOptions = {}) {
    this.host = host;
    this.port = port;
    this.responseTimeout = options.responseTimeout || DEFAULT_RESPONSE_TIMEOUT;
    this.maxRetries = options.maxRetries || DEFAULT_MAX_RETRIES;
    this.baseBackoff = options.baseBackoff || DEFAULT_BASE_BACKOFF;
    this.connectTimeout = options.connectTimeout || 10000;
  }

  /**
   * Connect to the remote MLLP server.
   *
   * @returns Promise that resolves when connected
   * @throws Error if connection fails
   */
  connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (this.connected && this.socket) {
        resolve();
        return;
      }

      this.socket = new net.Socket();

      const connectTimer = setTimeout(() => {
        if (this.socket) {
          this.socket.destroy();
        }
        reject(new Error(`Connection timeout after ${this.connectTimeout}ms to ${this.host}:${this.port}`));
      }, this.connectTimeout);

      this.socket.connect(this.port, this.host, () => {
        clearTimeout(connectTimer);
        this.connected = true;
        this.logger.info(`Connected to ${this.host}:${this.port}`);
        resolve();
      });

      this.socket.on('error', (err) => {
        clearTimeout(connectTimer);
        this.connected = false;
        this.logger.error('Socket error', { error: err.message });
        reject(err);
      });

      this.socket.on('close', () => {
        this.connected = false;
        this.logger.info(`Disconnected from ${this.host}:${this.port}`);
      });
    });
  }

  /**
   * Send an HL7v2 message and wait for the response (typically an ACK).
   * Includes retry logic with exponential backoff.
   *
   * @param message - Raw HL7v2 message string to send
   * @returns Promise that resolves with the response message string
   * @throws Error if sending fails after all retries
   */
  async send(message: string): Promise<string> {
    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      try {
        // Reconnect if needed
        if (!this.connected || !this.socket) {
          await this.connect();
        }

        const response = await this.sendOnce(message);
        return response;
      } catch (err) {
        lastError = err instanceof Error ? err : new Error(String(err));
        this.logger.warn(
          `Send attempt ${attempt + 1}/${this.maxRetries + 1} failed: ${lastError.message}`
        );

        // Disconnect before retry
        this.destroySocket();

        // Wait with exponential backoff before retrying (unless this was the last attempt)
        if (attempt < this.maxRetries) {
          const backoff = this.baseBackoff * Math.pow(2, attempt);
          this.logger.info(`Retrying in ${backoff}ms...`);
          await this.sleep(backoff);
        }
      }
    }

    throw new Error(
      `Failed to send message after ${this.maxRetries + 1} attempts. Last error: ${lastError?.message}`
    );
  }

  /**
   * Disconnect from the remote server.
   *
   * @returns Promise that resolves when disconnected
   */
  disconnect(): Promise<void> {
    return new Promise((resolve) => {
      if (!this.socket) {
        this.connected = false;
        resolve();
        return;
      }

      this.socket.end(() => {
        this.destroySocket();
        resolve();
      });

      // Force destroy after a short timeout if end doesn't complete
      setTimeout(() => {
        this.destroySocket();
        resolve();
      }, 2000);
    });
  }

  /**
   * Check if the client is currently connected.
   *
   * @returns true if connected to the remote server
   */
  isConnected(): boolean {
    return this.connected && this.socket !== null && !this.socket.destroyed;
  }

  /**
   * Send a single message and wait for a response.
   * No retry logic - just a single send/receive cycle.
   */
  private sendOnce(message: string): Promise<string> {
    return new Promise((resolve, reject) => {
      if (!this.socket || !this.connected) {
        reject(new Error('Not connected to MLLP server'));
        return;
      }

      const socket = this.socket;
      let buffer = Buffer.alloc(0);
      let responseTimer: ReturnType<typeof setTimeout>;

      // Set up response timeout
      responseTimer = setTimeout(() => {
        cleanup();
        reject(new Error(`Response timeout after ${this.responseTimeout}ms`));
      }, this.responseTimeout);

      const onData = (data: Buffer) => {
        buffer = Buffer.concat([buffer, data]);

        // Check for complete MLLP message
        const startIdx = buffer.indexOf(MLLP_START_BLOCK);
        if (startIdx === -1) return;

        for (let i = startIdx + 1; i < buffer.length - 1; i++) {
          if (buffer[i] === MLLP_END_BLOCK && buffer[i + 1] === MLLP_CARRIAGE_RETURN) {
            // Found complete message
            const responseMessage = buffer.slice(startIdx + 1, i).toString('utf-8');
            cleanup();
            resolve(responseMessage);
            return;
          }
        }
      };

      const onError = (err: Error) => {
        cleanup();
        reject(err);
      };

      const onClose = () => {
        cleanup();
        reject(new Error('Connection closed while waiting for response'));
      };

      const cleanup = () => {
        clearTimeout(responseTimer);
        socket.removeListener('data', onData);
        socket.removeListener('error', onError);
        socket.removeListener('close', onClose);
      };

      socket.on('data', onData);
      socket.on('error', onError);
      socket.on('close', onClose);

      // Frame and send the message
      const framedMessage = this.wrapInMLLP(message);
      socket.write(framedMessage, (err) => {
        if (err) {
          cleanup();
          reject(err);
        } else {
          this.logger.info(`Sent message (${message.length} bytes) to ${this.host}:${this.port}`);
        }
      });
    });
  }

  /**
   * Wrap an HL7 message string in MLLP framing.
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

  /**
   * Destroy the socket and reset state.
   */
  private destroySocket(): void {
    if (this.socket) {
      this.socket.removeAllListeners();
      this.socket.destroy();
      this.socket = null;
    }
    this.connected = false;
  }

  /**
   * Sleep for a given number of milliseconds.
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
