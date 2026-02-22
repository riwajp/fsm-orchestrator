import type { Message } from "./Message";

export abstract class Messenger<T> {
  protected recipientRoles: string[];
  protected messages: Map<string, Message<T>>;

  constructor(recipientRoles: string[] = []) {
    this.recipientRoles = recipientRoles;
    this.messages = new Map();
  }

  /** Register a message */
  registerMessage(message: Message<T>): void {
    this.messages.set(message.getKey(), message);
  }

  /** Get a registered message by key */
  protected getMessage(key: string): Message<T> | undefined {
    return this.messages.get(key);
  }

  /** Abstract send method */
  abstract send(messageKey: string, recipientRoles: string[]): void;
}
