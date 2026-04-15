import type { Messenger } from "../messaging";
import type { IEvent } from "../types";
import type { IEmitEvent, TCanBeInvoked } from "../types/action";
import type { IActionLogData } from "../types/logs";
import type { IState } from "../types/memory";

/**
 * Concrete Action class for defining actions that can be invokeed
 * based on the current state and can transition to one of the allowed output states.
 */
export class Action {
  /**
   * Unique key for the action.
   */
  public readonly key: string;

  /**
   * Description of the action (can be used as a tool description).
   */
  public readonly description: string;

  // Event to emit after the action is invoked.
  public readonly emitEvent?: IEmitEvent;

  /**
   * Function to check if the action can be invoked.
   */
  private readonly _canBeInvoked: (
    localState: IState,
    globalState: IState,
  ) => TCanBeInvoked;

  /**
   * Function to invoke the action.
   */
  private readonly _invoke: (
    localState: IState,
    globalState: IState,
    taskId?: string,
    subtaskId?: string,
    event?: IEvent,
    messenger?: Messenger<any>,
  ) => Promise<IActionLogData> | IActionLogData;

  constructor(
    key: string,
    description: string,
    canBeInvoked: (localState: IState, globalState: IState) => TCanBeInvoked,
    invoke: (
      localState: IState,
      globalState: IState,
      taskId?: string,
      subtaskId?: string,
      event?: IEvent,
      messenger?: Messenger<any>,
    ) => Promise<IActionLogData> | IActionLogData,
    emitEvent?: IEmitEvent,
  ) {
    this.key = key;
    this.description = description;
    this._canBeInvoked = canBeInvoked;
    this._invoke = invoke;

    this.emitEvent = emitEvent;
  }

  /**
   * Checks if the action can be invokeed given the current state.
   */
  public canBeInvoked(localState: IState, globalState: IState): TCanBeInvoked {
    return this._canBeInvoked(localState, globalState);
  }

  /**
   * invokes the action.
   */
  public async invoke(
    localState: IState,
    globalState: IState,
    taskId?: string,
    subtaskId?: string,
    event?: IEvent,
    messenger?: Messenger<any>,
  ): Promise<IActionLogData> {
    const result = await this._invoke(
      localState,
      globalState,
      taskId,
      subtaskId,
      event,
      messenger,
    );
    result.emitEvent = result.emitEvent ?? this.emitEvent;
    result.action_key = this.key;
    return result;
  }
}
