import { Action } from "../action/Action";
import type { IState } from "../types/memory";
import { Messenger } from "../messaging";
import type { IActionLogData } from "../types/logs";
import type { IEvent, IEventAction, ITrigger, TEventKey } from "../types";

/**
 * Represents a state-machine based workflow for a specific subtask type.
 * A Workflow defines how actions are triggered by events based on current state.
 */
export class Workflow {
  /** Unique identifier for the workflow */
  public readonly key: string;
  /** The key of the state where a subtask of this workflow begins */
  public readonly initialStateKey: string;
  private taskId?: string;
  private state?: IState;

  private initialStateData: Record<string, unknown> = {};

  // Use Map to prevent duplicate action keys
  private actions: Map<string, Action> = new Map();

  // Map<EventKey, Map<ActionKey, Trigger>>
  private triggers: ITrigger = {};

  constructor(key: string, initialStateKey: string, actions: Action[] = []) {
    this.key = key;
    this.initialStateKey = initialStateKey;

    actions.forEach((action) => this.registerAction(action));
  }

  /* ---------- State ---------- */

  public setInitialStateData(data: Record<string, unknown>): void {
    this.initialStateData = data;
  }

  public initState(): void {
    this.state = {
      key: this.initialStateKey,
      data: this.initialStateData,
    };
  }

  public getState(): IState | undefined {
    return this.state;
  }

  public setState(state: IState): void {
    this.state = state;
  }

  /* ---------- Actions ---------- */

  public registerAction(action: Action): void {
    const existing = this.actions.get(action.key);
    if (existing) {
      // Allow re-registration of the same instance (same action, multiple triggers)
      if (existing === action) return;
      throw new Error(
        `Action '${action.key}' is already registered in workflow '${this.key}'`,
      );
    }

    this.actions.set(action.key, action);
  }

  public addTrigger(
    eventKey: TEventKey,
    action: Action,
    condition?: (state: IState, event: IEvent) => boolean,
  ): void {
    this.registerAction(action);

    const eventActions = this.triggers[eventKey] ?? [];

    if (
      eventActions.find(
        (eventAction: IEventAction) => eventAction.action.key === action.key,
      )
    ) {
      throw new Error(
        `Trigger for action '${action.key}' already exists for event '${eventKey}' in workflow '${this.key}'`,
      );
    }

    eventActions.push({ action, condition: condition ?? undefined });
    this.triggers[eventKey] = eventActions;
  }

  /* ---------- Event Handling ---------- */

  /**
   * Handle an event against the given state.
   *
   * State and taskId are passed as arguments (not stored on the instance)
   * so that concurrent tasks don't corrupt each other.
   */
  public async handleEvent(
    event: IEvent,
    localState: IState,
    globalState: IState,
    taskId?: string,
    subtaskId?: string,
    messenger?: Messenger<any>,
  ): Promise<IActionLogData> {
    const eventActions = this.triggers[event.key] ?? [];

    if (!eventActions || eventActions.length === 0) {
      return {
        success: false,
        message: `No triggers registered for event '${event.key}'`,
        cost: 0,
        data: {},
      };
    }

    for (const { action, condition } of eventActions.values()) {
      if (condition && !condition(localState, globalState, event)) continue;

      const canInvoke = action.canBeInvoked(localState, globalState);
      if (!canInvoke.can) continue;

      try {
        const result = await action.invoke(
          localState,
          globalState,
          taskId,
          subtaskId,
          event,
          messenger,
        );

        return result;
      } catch (err: any) {
        return {
          action_key: action.key,
          success: false,
          message: err?.message ?? "Action execution failed",
          cost: 0,
          data: {},
        };
      }
    }

    return {
      success: false,
      message: `No valid action could be executed for event '${event.key}'`,
      cost: 0,
      data: {},
    };
  }

  public getActions(): Action[] {
    return Array.from(this.actions.values());
  }

  public setTaskId(taskId: string): void {
    this.taskId = taskId;
  }
  public getTaskId(): string | undefined {
    return this.taskId;
  }
}
