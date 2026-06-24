# Orchestrator Library

A state-based workflow orchestration library for managing complex business processes with events, actions, and state transitions.

## Core Concepts

#### 🎯 Tasks

Tasks represent individual instances of a workflow. In this version, tasks are hierarchical:
- **Task**: The root container holding `globalState` (shared across all subtasks) and an array of `subtasks`.
- **Subtask**: A specific execution unit within a task with its own `localState` and `workflowKey`.

```typescript
interface ITask {
  id: string; // Unique identifier
  globalState: IState; // Shared state
  subtasks: ISubtask[]; // Collection of active/completed subtasks
  createdAt: Date;
}

interface ISubtask {
  id: string;
  workflowKey: string;
  localState: IState; // Isolated state for this subtask
  createdAt: Date;
  status: "active" | "completed";
}
```

### 🔄 State

State represents the current condition of a task with associated data.

```typescript
interface IState {
  key: string; // Current state identifier
  data: Record<string, any>; // Flexible data payload
}
```

### 📋 Workflows

Workflows define the logic for a specific type of subtask.

```typescript
class Workflow {
  key: string;
  initialStateKey: string;

  addTrigger(eventKey, action, condition?): void;
  handleEvent(event, localState, globalState, ...): Promise<IActionLogData>;
}
```

### ⚡ Actions

Actions are atomic operations that interact with local and global states.

```typescript
class Action {
  key: string;
  description: string;

  // Now receives both local and global state
  canBeInvoked(localState: IState, globalState: IState): TCanBeInvoked;
  invoke(localState, globalState, taskId?, subtaskId?, event?, messenger?): Promise<IActionLogData>;
}
```

### 📡 Events

Events trigger actions on subtasks.

```typescript
interface IEvent {
  key: TEventKey;
  payload?: Record<string, any>;
}
```

### 📨 Messaging

Abstract messaging system for external communication (email, Slack, etc.).

```typescript
abstract class Messenger<T> {
  registerMessage(message: Message<T>): void;
  send(messageKey, recipientRoles): Promise<void>;
}

class Message<T> {
  key: string; // Unique identifier
  message: T; // Message payload
}
```

## Quick Start

### 1. Create a Workflow

Follow the pattern of defining parameters as variables first.

```typescript
import { Action, Workflow } from "./lib";

// Define the action
const actionKey = "send_verification_email";
const actionDesc = "Sends verification email to user";
const canInvoke = (local) => local.key === "awaiting_verification";
const invoke = async (local, global) => {
  await sendEmail(local.data.email);
  return {
    success: true,
    new_state: {
      key: "verification_sent",
      data: { ...local.data, sentAt: new Date() },
    },
  };
};

const sendVerificationAction = new Action(actionKey, actionDesc, canInvoke, invoke);

// Create the workflow
const wfKey = "user-onboarding";
const initial = "awaiting_verification";
const actions = [sendVerificationAction];

const myWorkflow = new Workflow(wfKey, initial, actions);
myWorkflow.addTrigger("user_registered", sendVerificationAction);
```

### 2. Create an Orchestrator

```typescript
const key = "user-management";
const workflows = [myWorkflow];
const messenger = emailMessenger;

const orchestrator = new MyOrchestrator(key, workflows, messenger);
```

### 3. Initialize a Task

Initializes a task with a starting subtask.

```typescript
const task = await orchestrator.initTask(
  { systemId: "123" }, // Task global data
  "user-onboarding",   // Initial subtask workflow
  { email: "user@example.com" } // Initial subtask data
);
```

### 4. Handle Events

Requires both `taskId` and `subtaskId`.

```typescript
const logs = await orchestrator.handleEvent(task.id, task.subtasks[0].id, {
  key: "email_verified",
  payload: { verifiedAt: new Date().toISOString() },
});
```

## Advanced Examples

### Subtask Spawning and Ending

Actions can now control subtask lifecycles:

```typescript
const spawnAction = new Action(
  "spawn_child",
  "Spawns a new subtask",
  () => ({ can: true }),
  async (local, global) => {
    return {
      success: true,
      spawn_subtask: {
        workflowKey: "child-workflow",
        initialData: { parentInfo: local.data.id }
      },
      // end_subtask: true // To complete the current subtask
    };
  }
);
```

### Global State Updates

```typescript
const updateGlobalAction = new Action(
  "update_global",
  "Updates shared global state",
  () => ({ can: true }),
  async (local, global) => {
    return {
      success: true,
      new_global_state: {
        ...global,
        data: { ...global.data, sharedValue: "updated" }
      }
    };
  }
);
```

## Error Handling

### Action Error Handling

```typescript
const robustAction = new Action(
  "risky_operation",
  "Performs operation with retry logic",
  (state) => state.key === "ready",
  async (state) => {
    try {
      const result = await performRiskyOperation(state.data);

      return {
        success: true,
        message: "Operation completed",
        new_state: {
          key: "completed",
          data: { ...state.data, result },
        },
      };
    } catch (error) {
      return {
        success: false,
        message: `Operation failed: ${error.message}`,
        new_state: {
          key: "failed",
          data: {
            ...state.data,
            error: error.message,
            failedAt: new Date(),
          },
        },
      };
    }
  },
);
```

### Workflow Error Handling

```typescript
// In your Orchestrator implementation
protected async persistInvocationLog(log: IInvocationLog): void {
  try {
    await this.logRepository.save(log);
  } catch (error) {
    console.error('Failed to persist log:', error);
    // Implement retry logic or fallback
  }
}
```

## Best Practices

### 1. State Design

- Keep state minimal and focused
- Use descriptive state keys
- Avoid deeply nested data structures
- Include metadata for debugging

```typescript
// Good
interface IState {
  key: "user_verified" | "verification_sent" | "verification_failed";
  data: {
    email: string;
    attempts: number;
    lastAttemptAt?: string;
    verificationToken?: string;
  };
}
```

### 2. Action Design

- Actions should be atomic and focused
- Return consistent result structure
- Handle all error cases
- Use descriptive messages

### 3. Event Design

- Use descriptive event keys
- Include relevant payload data
- Document event purposes

### 4. Testing

- Test actions independently
- Test workflow transitions
- Mock external dependencies
- Test error scenarios

## Architecture Patterns

### 1. Event-Driven Architecture

The orchestrator follows an event-driven pattern where events trigger state transitions:

```
Event → Action → New State → Next Event
```

### 2. State Machine Pattern

Each workflow represents a state machine with defined transitions:

```
[awaiting_verification] → (email_verified) → [verified]
[awaiting_verification] → (verification_failed) → [failed]
```

### 3. Command-Query Separation

Use events for commands (state changes) and separate queries for state inspection:

```typescript
// Commands (change state)
await orchestrator.handleEvent(taskId, subtaskId, { key: "verify_email" });

// Queries (inspect state)
const task = await orchestrator.getTask(taskId);
console.log(task.globalState.key);
```

## Performance Considerations

### 1. Efficient State Updates

- Only update state when necessary
- Use shallow copies for performance
- Implement efficient persistence

### 2. Memory Management

- Implement proper cleanup for long-running workflows
- Use streaming for large datasets
- Cache frequently accessed data

### 3. Error Recovery

- Implement retry logic with exponential backoff
- Use circuit breakers for external services
- Log errors comprehensively

## Integration Examples

### Database Integration

```typescript
class DatabaseOrchestrator extends Orchestrator {
  constructor(
    private db: Database,
    workflows: Workflow[] = [],
    messenger?: Messenger<any>,
  ) {
    super("app", workflows, messenger);
  }

  protected async persistTaskState(task: ITask): Promise<void> {
    await this.db.tasks.update(task.id, {
      state: task.globalState,
      updatedAt: new Date(),
    });
  }

  protected async persistInvocationLog(log: IInvocationLog): Promise<void> {
    await this.db.logs.insert(log);
  }
}
```

## API Reference

### `ITask` & `ISubtask`

```typescript
interface ITask {
  id: string;
  globalState: IState;
  subtasks: ISubtask[];
}

interface ISubtask {
  id: string;
  workflowKey: string;
  localState: IState;
  status: "active" | "completed";
}
```

### `IActionLogData`

```typescript
interface IActionLogData {
  success: boolean;
  new_state?: IState;        // Updates subtask local state
  new_global_state?: IState; // Updates task global state
  spawn_subtask?: { 
    workflowKey: string; 
    initialData?: Record<string, any> 
  };
  end_subtask?: boolean;     // Sets subtask status to completed
  emitEvent?: { key: string };
}
```

#### `IInvocationLog`

```typescript
interface IInvocationLog {
  timestamp: string;
  task_id: string;
  success: boolean;
  message?: string;
  event: IEvent;
  action_log_data?: IActionLogData;
}
```

## Contributing

When extending this library:

1. **Follow the patterns** established in the core classes
2. **Implement abstract methods** properly with error handling
3. **Use TypeScript** for type safety
4. **Add comprehensive tests** for new functionality
5. **Document** new events, actions, and state transitions
