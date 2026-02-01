import type { Action, TActionLog, TActionResult } from "./Action";
import type { TTransitionTable } from "./TransitionTable";

/**
 * Orchestrator is a generic state machine manager for handling status transitions,
 * memory updates, action dispatching, and persistent logging.
 *
 * @template TStatus - The type representing possible statuses (string or number).
 * @template TMemory - The type representing the memory/state object.
 */
export class Orchestrator<TStatus extends string | number, TMemory> {
  /** Current status of the orchestrator */
  private _status: TStatus;
  /** Current memory/state of the orchestrator */
  private _memory: TMemory;
  /** Log of all actions performed */
  private _logs: TActionLog[] = [];

  /** Registered actions mapped by their keys */
  private actions = new Map<string, Action<TStatus, TMemory>>();
  /** Transition table mapping statuses and actions to next statuses */
  private transitions: TTransitionTable<TStatus>;
  /** Set of statuses considered final (no further transitions allowed) */
  private finalStatuses: Set<TStatus>;

  /**
   * Optional callback invoked after every update to persist the state (status, memory, logs).
   * Useful for saving state to a database, file, or external storage.
   */
  private handlePersistentStorage?: (
    status: TStatus,
    memory: TMemory,
    logs: TActionLog[],
  ) => void;

  /**
   * Creates a new Orchestrator instance.
   * @param memory - Initial memory/state object.
   * @param options - Configuration options.
   *   - initialStatus: The starting status.
   *   - finalStatuses: Array of statuses considered final.
   *   - transitions: Transition table mapping statuses and actions.
   *   - handlePersistentStorage: Optional callback for persisting state.
   */
  constructor(
    memory: TMemory,
    options: {
      initialStatus: TStatus;
      finalStatuses?: TStatus[];
      transitions: TTransitionTable<TStatus>;
      handlePersistentStorage?: (
        status: TStatus,
        memory: TMemory,
        logs: TActionLog[],
      ) => void;
    },
  ) {
    this._memory = memory;
    this._status = options.initialStatus;

    this.transitions = options.transitions;
    this.finalStatuses = new Set(options.finalStatuses ?? []);
    this.handlePersistentStorage = options.handlePersistentStorage;
  }

  /** ---------------- Actions ---------------- */

  /**
   * Registers an action with the orchestrator.
   * @param action - The action to add.
   */
  addAction(action: Action<TStatus, TMemory>) {
    this.actions.set(action.key, action);
  }

  /**
   * Checks if the current status is a final status.
   * @returns True if current status is final, false otherwise.
   */
  isFinalStatus(): boolean {
    return this.finalStatuses.has(this._status);
  }

  /** ---------------- Status Access ---------------- */

  /**
   * Gets the current status.
   */
  get status(): TStatus {
    return this._status;
  }

  /**
   * Sets the current status and persists the state.
   */
  private set status(newStatus: TStatus) {
    this._status = newStatus;
    this.persist();
  }

  /** ---------------- Memory Access ---------------- */

  /**
   * Gets the current memory/state object.
   */
  get memory(): TMemory {
    return this._memory;
  }

  /**
   * Sets the memory/state object and persists the state.
   */
  set memory(newMemory: TMemory) {
    this._memory = newMemory;
    this.persist();
  }

  /**
   * Updates the memory/state object with a partial update and persists the state.
   * @param partial - Partial memory object to merge.
   */
  updateMemory(partial: Partial<TMemory>) {
    this._memory = { ...this._memory, ...partial };
    this.persist();
  }

  /** ---------------- Logs Access ---------------- */

  /**
   * Gets a copy of the action logs.
   */
  get logs(): TActionLog[] {
    return [...this._logs];
  }

  /**
   * Adds a log entry and persists the state.
   * @param log - The action log to add.
   */
  addLog(log: TActionLog) {
    this._logs.push(log);
    this.persist();
  }

  /** ---------------- Persistence ---------------- */

  /**
   * Persists the current state using the provided persistent storage handler, if available.
   */
  private persist() {
    if (this.handlePersistentStorage) {
      this.handlePersistentStorage(this._status, this._memory, this._logs);
    }
  }

  /** ---------------- Dispatch ---------------- */

  /**
   * Dispatches an action by key, performing the transition and updating state.
   * Throws if the current status is final or the action is unknown.
   * Uses the status returned by the action if present, otherwise uses the transition table.
   * @param actionKey - The key of the action to dispatch.
   */
  async dispatch(actionKey: string) {
    if (this.isFinalStatus()) {
      throw new Error(`Cannot transition from final status: ${this._status}`);
    }

    const action = this.actions.get(actionKey);
    if (!action) {
      throw new Error(`Unknown action: ${actionKey}`);
    }

    const from = this._status;
    const defaultTo = this.transitions[from]?.[actionKey] ?? from;

    // Execute action
    const result: TActionResult<TStatus, TMemory> = await action.perform(
      this._status,
      this._memory,
    );

    // Store action log
    if (action.log) {
      this.addLog(action.log); // automatically persists
    }

    // Determine next status: use result.status if present, else use transition table
    const nextStatus = result.status !== undefined ? result.status : defaultTo;
    this.status = nextStatus;

    // Update memory if changed
    if (result.memory) {
      this.updateMemory(result.memory);
    } else {
      this.persist(); // persist even if memory didn't change
    }
  }
}
