import type { Messenger } from "../messaging";
import type { TCanBeInvoked } from "../types/action";
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

  /**
   * Constructs a new Action.
   * @param key - Unique key for the action.
   * @param description - Description of the action.
   * @param transitions - Map of input state key to array of possible output state keys.
   * @param canBeInvoked - Function to check if action can be invoked.
   * @param perform - Function to perform the action.
   */
  constructor(
    key: string,
    description: string,
    canBeInvoked: (state: IState) => TCanBeInvoked,
    perform: (
      state: IState,
      messenger?: Messenger<any>,
    ) => Promise<IActionLogData> | IActionLogData,
  ) {
    this.key = key;
    this.description = description;
    this._canBeInvoked = canBeInvoked;
    this._perform = perform;
  }

  /**
   * Checks if the action can be performed given the current state.
   * @param state - The current state.
   * @returns An object indicating if the action can be performed, and a description if not.
   */
  public canBeInvoked(state: IState): TCanBeInvoked {
    return this._canBeInvoked(state);
  }

  /**
   * Performs the action, given the current state.
   * @param state - The current state.
   * @returns The new state after performing the action.
   */
  public invoke(
    state: IState,
    messenger?: Messenger<any>,
  ): Promise<IActionLogData> | IActionLogData {
    return this._perform(state, messenger);
  }
}
