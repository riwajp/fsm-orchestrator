/**
 * Onboarding Process Automation Example
 *
 * This example demonstrates how to use the Orchestrator to automate a fictional
 * business process: onboarding a new employee. The process includes collecting documents,
 * setting up accounts, and completing orientation.
 *
 * The orchestrator manages the workflow, transitions, memory, and logs.
 */

import { Orchestrator } from "../src/Orchestrator";
import { Action } from "../src/Action";
import type { TTransitionTable } from "../src/TransitionTable";

// Define possible statuses for the onboarding process
type Status =
  | "awaiting_documents"
  | "documents_verified"
  | "accounts_setup"
  | "orientation_complete"
  | "onboarding_complete"
  | "error";

// Define the shape of the memory/state object
interface Memory {
  employeeName: string;
  documentsReceived: boolean;
  accountsCreated: boolean;
  orientationDone: boolean;
  notes: string[];
}

// Define the transition table for the onboarding process
const transitions: TTransitionTable<Status> = {
  awaiting_documents: { verify_documents: "documents_verified" },
  documents_verified: { setup_accounts: "accounts_setup" },
  accounts_setup: { complete_orientation: "orientation_complete" },
  orientation_complete: { finish_onboarding: "onboarding_complete" },
  onboarding_complete: {},
  error: { retry: "awaiting_documents" },
};

// Create the orchestrator instance
const orchestrator = new Orchestrator<Status, Memory>(
  {
    employeeName: "Jane Doe",
    documentsReceived: false,
    accountsCreated: false,
    orientationDone: false,
    notes: [],
  },
  {
    initialStatus: "awaiting_documents",
    finalStatuses: ["onboarding_complete"],
    transitions,
    handlePersistentStorage: (status, memory, logs) => {
      // For demonstration, we'll just log the state to the console
      console.log("Persisting state:", { status, memory, logs });
    },
  },
);

// Register actions

// 1. Verify Documents (with random failure, returns status)
orchestrator.addAction(
  new Action<Status, Memory>({
    key: "verify_documents",
    execute: (status, memory) => {
      if (Math.random() < 0.3) {
        return {
          status: "error",
          memory: {
            notes: [...(memory.notes ?? []), "Document verification failed!"],
          },
        };
      }
      return {
        status: "documents_verified",
        memory: {
          documentsReceived: true,
          notes: [...(memory.notes ?? []), "Documents verified."],
        },
      };
    },
    generateLog: () => "Employee documents have been verified (or failed).",
  }),
);

// 2. Setup Accounts (with random failure, returns status)
orchestrator.addAction(
  new Action<Status, Memory>({
    key: "setup_accounts",
    execute: (status, memory) => {
      if (Math.random() < 0.3) {
        return {
          status: "error",
          memory: {
            notes: [...(memory.notes ?? []), "Account setup failed!"],
          },
        };
      }
      return {
        status: "accounts_setup",
        memory: {
          accountsCreated: true,
          notes: [...(memory.notes ?? []), "Accounts set up."],
        },
      };
    },
    generateLog: () => "Employee accounts have been set up (or failed).",
  }),
);

// 3. Complete Orientation (with random failure, returns status)
orchestrator.addAction(
  new Action<Status, Memory>({
    key: "complete_orientation",
    execute: (status, memory) => {
      if (Math.random() < 0.3) {
        return {
          status: "error",
          memory: {
            notes: [...(memory.notes ?? []), "Orientation failed!"],
          },
        };
      }
      return {
        status: "orientation_complete",
        memory: {
          orientationDone: true,
          notes: [...(memory.notes ?? []), "Orientation completed."],
        },
      };
    },
    generateLog: () => "Employee orientation completed (or failed).",
  }),
);

// 4. Finish Onboarding
orchestrator.addAction(
  new Action<Status, Memory>({
    key: "finish_onboarding",
    execute: (status, memory) => ({
      status: "onboarding_complete",
      memory: {
        notes: [...(memory.notes ?? []), "Onboarding process finished."],
      },
    }),
    generateLog: () => "Onboarding process is complete.",
  }),
);

// Add a retry action for error recovery
orchestrator.addAction(
  new Action<Status, Memory>({
    key: "retry",
    execute: (status, memory) => ({
      status: "awaiting_documents",
      memory: {
        notes: [...(memory.notes ?? []), "Retrying from error state."],
      },
    }),
    generateLog: () => "Retrying process after error.",
  }),
);

// Example business process automation workflow with error handling and retry
async function runBusinessProcess() {
  console.log("Initial status:", orchestrator.status);
  console.log("Initial memory:", orchestrator.memory);

  let finished = false;
  let attempts = 0;
  while (!finished && attempts < 10) {
    attempts++;
    try {
      if (orchestrator.status === "awaiting_documents") {
        await orchestrator.dispatch("verify_documents");
        console.log(
          "After 'verify_documents':",
          orchestrator.status,
          orchestrator.memory,
        );
      }
      if (orchestrator.status === "documents_verified") {
        await orchestrator.dispatch("setup_accounts");
        console.log(
          "After 'setup_accounts':",
          orchestrator.status,
          orchestrator.memory,
        );
      }
      if (orchestrator.status === "accounts_setup") {
        await orchestrator.dispatch("complete_orientation");
        console.log(
          "After 'complete_orientation':",
          orchestrator.status,
          orchestrator.memory,
        );
      }
      if (orchestrator.status === "orientation_complete") {
        await orchestrator.dispatch("finish_onboarding");
        console.log(
          "After 'finish_onboarding':",
          orchestrator.status,
          orchestrator.memory,
        );
      }
      if (orchestrator.status === "onboarding_complete") {
        finished = true;
        break;
      }
      if (orchestrator.status === "error") {
        console.warn("Error encountered! Retrying process...");
        await orchestrator.dispatch("retry");
        console.log("After 'retry':", orchestrator.status, orchestrator.memory);
      }
    } catch (err) {
      console.error("Error:", (err as Error).message);
      break;
    }
  }

  if (!finished) {
    console.error("Failed to complete onboarding after several attempts.");
  }

  // Show action logs
  console.log("Action logs:", orchestrator.logs);
}

// Run the example
runBusinessProcess();

/**
 * Expected Output:
 *
 * Initial status: awaiting_documents
 * Initial memory: { employeeName: 'Jane Doe', documentsReceived: false, ... }
 * ... (steps may randomly fail and transition to error)
 * After 'retry': awaiting_documents { ... }
 * ... (process continues until onboarding_complete or max attempts)
 * Action logs: [ ... ]
 */
