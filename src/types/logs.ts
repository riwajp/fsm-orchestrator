import type { IEmitEvent } from "./action";
import type {  IState } from "./memory";
import type { IEvent } from "./workflow";

export interface IActionLogData {
  action_key?: string;
  cost: number;
  success: boolean;
  message?: string;
  data?: Record<string, any>;
  new_state?: IState;
  emitEvent?: IEmitEvent;
}

export interface IInvocationLog {
  timestamp: string;
  task_id: string;
  success: boolean;
  message?: string;
  event: IEvent;

  action_log_data?: IActionLogData;
}
