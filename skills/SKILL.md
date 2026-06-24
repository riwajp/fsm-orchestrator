---
name: Orchestrator
description: A task orchestration library based on events, actions, and workflows.
---

# Orchestrator Skill

The Orchestrator is a framework designed to manage complex, multi-step tasks using an event-driven architecture. It provides a structured way to define workflows, actions, and state transitions.

## Core Concepts

### 1. Orchestrator
The `Orchestrator` is the central manager. It handles:
- **Task Management**: Creating and tracking tasks.
- **Workflow Registration**: Managing different workflows.
- **Event Handling**: Dispatching events to specific subtasks.
- **Persistence**: Saving task state and invocation logs.

### 2. Task & Subtask
The orchestrator uses a hierarchical task structure:
- **ITask**: Represents the overall task. It contains `globalState` (shared data) and a collection of `subtasks`.
- **ISubtask**: Represents a specific execution context within a task. It has its own `localState` and follows a specific `Workflow`.

### 3. Workflow
A `Workflow` defines a sequence of operations for a specific type of subtask. It consists of:
- **Actions**: The building blocks of the workflow.
- **Triggers**: Mapping events to actions with optional conditions (based on local and global state).

### 4. Action
An `Action` represents a single unit of work. It includes:
- **Key**: Unique identifier.
- **Description**: Human-readable description.
- **canBeInvoked**: A guard function that checks if the action can run based on `localState` and `globalState`.
- **invoke**: The actual logic execution. It receives `localState`, `globalState`, and other context, returning a result that can update both local and global states, or even spawn/end subtasks.

### 5. Event
Events trigger transitions in the workflow. Each event has a `key` and an optional `payload`.

## How to Build with Orchestrator

### Creating a New Action

Actions are defined as instances of the `Action` class. Follow the pattern of defining parameters as variables first.

```typescript
import { Action } from "../lib/action/Action";

const key = "my_action_key";
const description = "Brief description of what this action does";

const canBeInvoked = (localState, globalState) => {
  // Return { can: true } if this action can be invoked
  return { can: localState.key === "some_required_state" };
};

const invoke = async (localState, globalState, taskId, subtaskId, event) => {
  // Logic goes here
  const updatedLocalData = { ...localState.data, foo: "bar" };
  
  return {
    success: true,
    new_state: {
      key: "next_state_key",
      data: updatedLocalData,
    },
    // Optional: Update global state
    // new_global_state: { ...globalState, data: { ...globalState.data, ... } },
    message: "Action completed successfully",
    data: { result: "some data" },
  };
};

const emitEvent = { key: "next_event_key" }; // Optional: auto-emit this event

const myAction = new Action(
  key,
  description,
  canBeInvoked,
  invoke,
  emitEvent
);

export default myAction;
```

### Creating and Configuring a Workflow

Workflows are created by instantiating `Workflow` and adding triggers.

```typescript
import { Workflow } from "../lib";
import myAction from "../actions/myAction";

const key = "my_workflow_key";
const initialState = "Initial";
const actions = [myAction];

const myWorkflow = new Workflow(key, initialState, actions);

myWorkflow.addTrigger("Start", myAction);
myWorkflow.addTrigger("Next", anotherAction, (localState, globalState, event) => {
  // Optional condition: only run if this returns true
  return event.payload.ready === true;
});

export default myWorkflow;
```

### Implementing a Concrete Orchestrator

Subclass `Orchestrator` to provide persistence and specific features.

```typescript
class MyOrchestrator extends Orchestrator {
  protected async persistTaskState(task: ITask) {
    // Implement database save logic (handles both global and subtask states)
  }

  protected persistInvocationLog(log: IInvocationLog) {
    // Implement logging logic
  }

  protected async learn(learningData: { key: string; data: any }) {
    // Implement AI learning/memory optimization logic
  }
}
```

## Best Practices

1.  **Atomicity**: Keep actions small and focused on a single responsibility.
2.  **State Immutability**: Always return a new state object instead of mutating the existing one.
3.  **Event Chaining**: Use `emitEvent` for linear flows; use manual `handleEvent` calls in orchestrator for more complex logic if necessary.
4.  **Descriptive Keys**: Use clear, consistent naming for events, states, and actions.
5.  **Guard Clauses**: Use `canBeInvoked` to ensure the system is in the correct state before running an action.
6.  **Multiple Workflows**: The orchestrator is designed to handle multiple workflows simultaneously. Break down complex business processes into logical workflows that focus on a specific sub-goal. Avoid creating workflows that are either too granular (one action) or too monolithic (spanning multiple business domains).
7.  **Modular Services**: External integrations (Slack, Close, CRM, etc.) should be encapsulated in reusable service modules. Use the tool's official SDK wherever possible instead of raw API calls for better reliability and feature support.
8.  **Environment Variables**: Never hardcode API keys or sensitive configurations. Always retrieve them from environment variables. Create a config file that imports and exports all env for easy access.
9.  **Event Listeners & Webhooks**: Implement dedicated webhook handlers to listen for external events and translate them into Orchestrator events. These handlers should be modular and map external payloads to the `IEvent` structure.
10. **Proper Documentation**: Maintain clear comments in your actions and services to explain the business logic and side effects.
