
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
