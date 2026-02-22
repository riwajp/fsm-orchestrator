import { Action } from "../action/Action";
import type { IEvent, IState } from "../types/memory";
import { Messenger } from "../messaging";
import type { IActionLogData } from "../types/logs";

export class Workflow {
  public readonly key: string;
  public readonly initialStateKey: string;

  private state?: IState;

  private initialStateData: Record<string, unknown> = {};

  // Use Map to prevent duplicate action keys
  private actions: Map<string, Action> = new Map();

  // Map<EventKey, Map<ActionKey, Trigger>>
  private conditions: Map<
    string,
    Map<
      string,
      {
        action: Action;
        condition: (state: IState, event: IEvent) => boolean;
      }
    >
  > = new Map();

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
    if (this.actions.has(action.key)) {
      throw new Error(
        `Action '${action.key}' is already registered in workflow '${this.key}'`,
      );
    }

    this.actions.set(action.key, action);
  }

  public addTrigger(
    eventKey: string,
    action: Action,
    condition: (state: IState, event: IEvent) => boolean,
  ): void {
    this.registerAction(action);

    const eventTriggers = this.conditions.get(eventKey) ?? new Map();

    if (eventTriggers.has(action.key)) {
      throw new Error(
        `Trigger for action '${action.key}' already exists for event '${eventKey}' in workflow '${this.key}'`,
      );
    }

    eventTriggers.set(action.key, { action, condition });
    this.conditions.set(eventKey, eventTriggers);
  }

  /* ---------- Event Handling ---------- */

  public async handleEvent(
    event: IEvent,
    messenger?: Messenger<any>,
  ): Promise<IActionLogData> {
    if (!this.state) {
      return {
        success: false,
        message: "Invalid state",
        cost: 0,
        data: {},
      };
    }

    const triggers = this.conditions.get(event.key);

    if (!triggers || triggers.size === 0) {
      return {
        success: false,
        message: `No triggers registered for event '${event.key}'`,
        cost: 0,
        data: {},
      };
    }

    for (const { action, condition } of triggers.values()) {
      if (!condition(this.state, event)) continue;

      const canInvoke = action.canBeInvoked(this.state);
      if (!canInvoke.can) continue;

      try {
        const result = await action.invoke(this.state, messenger);

        if (result.success) {
          this.state = result.new_state;
        }

        return result;
      } catch (err: any) {
        return {
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
}
