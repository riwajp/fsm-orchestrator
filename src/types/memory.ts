// ===============================
// Type Definitions for Memory
// ===============================

// State type: contains a key and a data object
export type IState = {
  key: string;
  data: Record<string, any>;
};

// Event type with key and payload
export interface IEvent {
  key: string;
  payload?: Record<string, any>;
}

// Log entry type with event, timestamp, and additional data
export interface ILogEntry {
  event: IEvent;
  timestamp: string; // ISO 8601 format
  data: Record<string, any>;
}

// Queue structure for events
export interface IQueue {
  enqueue(item: IEvent): void;
  dequeue(): IEvent | undefined;
  peek(): IEvent | undefined;
  isEmpty(): boolean;
  size(): number;
}

// Identity type for system prompt
export type TIdentity = string;
