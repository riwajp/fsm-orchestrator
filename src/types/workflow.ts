import type { Action } from "../action/Action";
import type { IState } from "./memory";

export type ISubtask = {
  id: string;
  workflowKey: string;
  localState: IState;
  createdAt: Date;
  status: "active" | "completed";
};

export type ITask = {
  id: string;
  globalState: IState;
  subtasks: ISubtask[];
  createdAt: Date;
};

export type TEventKey = string;

export interface IEventAction {
  action: Action;
  condition?: (localState: IState, globalState: IState, event: IEvent) => boolean;
}
// Event type with key and payload
export interface IEvent {
  key: TEventKey;
  payload?: Record<string, any>;
}

export interface ITrigger {
  [eventKey: TEventKey]: IEventAction[];
}
