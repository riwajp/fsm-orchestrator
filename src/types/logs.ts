import type { IEmitEvent } from "./action";
import type { IEvent, IState } from "./memory";

export interface IActionLogData {
  action_key?: string;
  cost: number;
  success: boolean;
  message?: string;
  data?: Record<string, unknown>;
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
