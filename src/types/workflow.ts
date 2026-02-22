import type { Action } from "../action/Action";
import type { IEvent, IState } from "./memory";

export type ITask = {
  id: string;
  workflowKey: string;
  state: IState;
  createdAt: Date;
};

export type ITrigger = {
  action: Action;
  condition: (state: IState, event: IEvent) => boolean;
};
