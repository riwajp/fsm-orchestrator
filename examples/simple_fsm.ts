/**
 * Simple Orchestrator Example
 *
 * This example demonstrates how to use the Orchestrator, Action, and TransitionTable
 * to manage a basic workflow with three statuses: "idle", "running", and "done".
 *
 * The orchestrator manages state transitions, memory updates, and logs actions.
 */

import { Orchestrator } from "../src/Orchestrator";
import { Action } from "../src/Action";
import type { TTransitionTable } from "../src/TransitionTable";

// Define possible statuses for the workflow
type Status = "idle" | "running" | "done";

// Define the shape of the memory/state object
interface Memory {
  count: number;
}

// Define the transition table for status changes
const transitions: TTransitionTable<Status> = {
  idle: { start: "running" },
  running: { finish: "done", stop: "idle" },
  done: {},
};

// Create the orchestrator instance
const orchestrator = new Orchestrator<Status, Memory>(
  { count: 0 }, // initial memory
  {
    initialStatus: "idle",
    finalStatuses: ["done"],
    transitions,
    handlePersistentStorage: (status, memory, logs) => {
      // For demonstration, we'll just log the state to the console
      console.log("Persisting state:", { status, memory, logs });
    },
  },
);

// Register actions

// "start" action: transitions from "idle" to "running" and increments count
orchestrator.addAction(
  new Action<Status, Memory>({
    key: "start",
    execute: (status, memory) => ({
      status: "running",
      memory: { count: (memory.count ?? 0) + 1 },
    }),
    generateLog: () => "Workflow started.",
  }),
);

// "finish" action: transitions from "running" to "done"
orchestrator.addAction(
  new Action<Status, Memory>({
    key: "finish",
    execute: (status, memory) => ({
      status: "done",
      memory: { count: memory.count ?? 0 },
    }),
    generateLog: () => "Workflow finished.",
  }),
);

// "stop" action: transitions from "running" to "idle"
orchestrator.addAction(
  new Action<Status, Memory>({
    key: "stop",
    execute: (status, memory) => ({
      status: "idle",
      memory: { count: memory.count ?? 0 },
    }),
    generateLog: () => "Workflow stopped.",
  }),
);

// Example workflow execution
async function runExample() {
  console.log("Initial status:", orchestrator.status); // "idle"
  console.log("Initial memory:", orchestrator.memory); // { count: 0 }

  // Start the workflow
  await orchestrator.dispatch("start");
  console.log("After 'start':", orchestrator.status, orchestrator.memory);

  // Finish the workflow
  await orchestrator.dispatch("finish");
  console.log("After 'finish':", orchestrator.status, orchestrator.memory);

  // Attempting to dispatch another action in final status will throw an error
  try {
    await orchestrator.dispatch("start");
  } catch (err) {
    console.error("Error:", (err as Error).message);
  }

  // Show action logs
  console.log("Action logs:", orchestrator.logs);
}

// Run the example
runExample();

/**
 * Expected Output:
 *
 * Initial status: idle
 * Initial memory: { count: 0 }
 * Persisting state: { status: 'running', memory: { count: 1 }, logs: [ ... ] }
 * After 'start': running { count: 1 }
 * Persisting state: { status: 'done', memory: { count: 1 }, logs: [ ... ] }
 * After 'finish': done { count: 1 }
 * Error: Cannot transition from final status: done
 * Action logs: [ ... ]
 */
