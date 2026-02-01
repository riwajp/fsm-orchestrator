/**
 * Transition table type for orchestrator state machines.
 *
 * Maps each possible status (`From`) to an object whose keys are action names,
 * and whose values are the resulting status after that action.
 *
 * Example:
 * {
 *   idle: { start: "running" },
 *   running: { stop: "idle", finish: "done" },
 *   done: {}
 * }
 *
 * @template TStatus - The type representing possible statuses (string or number).
 */
export type TTransitionTable<TStatus extends string | number> = {
  [From in TStatus]?: {
    [ActionKey: string]: TStatus;
  };
};
