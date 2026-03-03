import type { Action } from "../action/Action";
import type {  IState } from "./memory";

export type ITask = {
  id: string;
  workflowKey: string;
  state: IState;
  createdAt: Date;
};

export type TEventKey =string;

export interface IEventAction  {
  action: Action;
  condition: (state: IState, event: IEvent) => boolean;
}
// Event type with key and payload
export interface IEvent {
  key: TEventKey;
  payload?: Record<string, any>;
}


export interface ITrigger{
[eventKey: TEventKey]: IEventAction[];

}
