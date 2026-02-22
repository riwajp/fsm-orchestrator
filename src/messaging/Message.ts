/**
 * Message - lightweight typed container for a payload and a unique key.
 *
 * This small class is intentionally minimal and focuses on providing a clear
 * structure for messages used across the orchestrator. It stores:
 * - `key`: a unique identifier for the message (used as a lookup key in stores)
 * - `message`: the payload associated with the key
 *
 * The class provides simple accessors and is generic so callers can strongly
 * type the payload.
 *
 * Example:
 * ```ts
 * const m = new Message<string>('welcome', 'Welcome to the platform!');
 * console.log(m.getKey()); // 'welcome'
 * console.log(m.getMessage()); // 'Welcome to the platform!'
 * ```
 *
 * @template T Type of the payload (defaults to `any` when not specified)
 */
export class Message<T = any> {
  /** Unique message key used for lookup and storage. */
  readonly key: string;

  /** The payload of the message. */
  readonly message: T;

  /**
   * Create a new Message instance.
   *
   * @param key - Unique string identifier for the message
   * @param message - Payload associated with the key
   */
  constructor(key: string, message: T) {
    if (typeof key !== "string" || key.trim().length === 0) {
      throw new TypeError("Message key must be a non-empty string");
    }
    this.key = key;
    this.message = message;
  }

  /**
   * Get the message key.
   * @returns The unique key of the message.
   */
  getKey(): string {
    return this.key;
  }

  /**
   * Get the message payload.
   * @returns The payload of the message.
   */
  getMessage(): T {
    return this.message;
  }

  /**
   * Convert the message to a plain object. Useful for logging/serialization.
   */
  toObject(): { key: string; message: T } {
    return { key: this.key, message: this.message };
  }
}
