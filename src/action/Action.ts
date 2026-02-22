import type { Messenger } from "../messaging";
import type { IEmitEvent, TCanBeInvoked } from "../types/action";
import type { IActionLogData } from "../types/logs";
import type { IState } from "../types/memory";

/**
 * Concrete Action class for defining actions that can be performed
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

  public readonly emitEvent?: IEmitEvent;

  /**
   * Function to check if the action can be invoked.
   */
  private readonly _canBeInvoked: (state: IState) => TCanBeInvoked;

  /**
   * Function to perform the action.
   */
  private readonly _perform: (
    state: IState,
    messenger?: Messenger<any>,
  ) => Promise<IActionLogData> | IActionLogData;

  constructor(
    key: string,
    description: string,
    canBeInvoked: (state: IState) => TCanBeInvoked,
    perform: (
      state: IState,
      messenger?: Messenger<any>,
    ) => Promise<IActionLogData> | IActionLogData,
    emitEvent?: IEmitEvent,
  ) {
    this.key = key;
    this.description = description;
    this._canBeInvoked = canBeInvoked;
    this._perform = perform;

    this.emitEvent = emitEvent;
  }

  /**
   * Checks if the action can be performed given the current state.
   */
  public canBeInvoked(state: IState): TCanBeInvoked {
    return this._canBeInvoked(state);
  }

  /**
   * Performs the action.
   */
  public async invoke(
    state: IState,
    messenger?: Messenger<any>,
  ): Promise<IActionLogData> {
    const result = await this._perform(state, messenger);
    result.emitEvent = this.emitEvent;
    return result;
  }
}
