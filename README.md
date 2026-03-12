# Orchestrator Library

A state-based workflow orchestration library for managing complex business processes with events, actions, and state transitions.

## Core Concepts

### 🎯 Tasks

Tasks represent individual instances of a workflow that contain state and evolve over time.

```typescript
interface ITask {
  id: string; // Unique identifier
  workflowKey: string; // Which workflow this task belongs to
  state: IState; // Current state and data
  createdAt: Date; // When the task was created
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

Workflows define the sequence of states and actions that can be executed.

```typescript
class Workflow {
  key: string; // Unique workflow identifier
  initialStateKey: string; // Starting state key

  // Methods
  registerAction(action: Action): void;
  addTrigger(eventKey, action, condition?): void;
  handleEvent(event, messenger?): Promise<IActionLogData>;
}
```

### ⚡ Actions

Actions are atomic operations that can be executed when conditions are met.

```typescript
class Action {
  key: string; // Unique action identifier
  description: string; // Human-readable description

  // Methods
  canBeInvoked(state: IState): TCanBeInvoked;
  invoke(state, taskId?, event?, messenger?): Promise<IActionLogData>;
}
```

### 📡 Events

Events trigger actions and can carry payloads.

```typescript
interface IEvent {
  key: TEventKey; // Event identifier
  payload?: Record<string, any>; // Optional event data
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

```typescript
import { Orchestrator, Action, Workflow } from "./lib";

const myWorkflow = new Workflow("user-onboarding", "awaiting_verification", [
  // Define actions
  new Action(
    "send_verification_email",
    "Sends verification email to user",
    (state) => state.key === "awaiting_verification",
    async (state) => {
      // Action logic here
      await sendEmail(state.data.email);

      return {
        success: true,
        message: "Verification email sent",
        new_state: {
          key: "verification_sent",
          data: { ...state.data, sentAt: new Date() },
        },
      };
    },
    { key: "verification_sent" }, // Event to emit
  ),
]);

// Add triggers
myWorkflow.addTrigger("user_registered", sendVerificationAction);
```

### 2. Create an Orchestrator

```typescript
const orchestrator = new MyOrchestrator(
  "user-management",
  [myWorkflow],
  emailMessenger, // Optional: for external messaging
);

// Register workflow
orchestrator.registerWorkflow(myWorkflow);
```

### 3. Initialize a Task

```typescript
const task = await orchestrator.initTask("user-onboarding", {
  email: "user@example.com",
  name: "John Doe",
  registrationDate: new Date().toISOString(),
});
```

### 4. Handle Events

```typescript
const logs = await orchestrator.handleEvent(task.id, {
  key: "email_verified",
  payload: { verifiedAt: new Date().toISOString() },
});
```

## Advanced Examples

### Conditional Triggers

```typescript
myWorkflow.addTrigger("user_action", sendPromoAction, (state, event) => {
  // Only send promo if user is active and hasn't received one recently
  return (
    (state.data.isActive && !state.data.lastPromoDate) ||
    new Date(event.payload.lastPromoDate) >
      new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
  );
});
```

### Complex State Management

```typescript
const complexAction = new Action(
  "process_order",
  "Processes customer order with inventory check",
  (state) => state.key === "order_received",
  async (state) => {
    const { orderId, items } = state.data;

    // Check inventory
    const inventory = await checkInventory(items);

    if (inventory.available) {
      return {
        success: true,
        message: "Order processed successfully",
        cost: calculateCost(items),
        new_state: {
          key: "order_processed",
          data: {
            ...state.data,
            processedAt: new Date(),
            inventoryReserved: inventory.reserved,
            totalCost: inventory.cost,
          },
        },
      };
    } else {
      return {
        success: false,
        message: "Insufficient inventory",
        new_state: {
          key: "order_failed",
          data: {
            ...state.data,
            failureReason: "insufficient_inventory",
            failedAt: new Date(),
          },
        },
      };
    }
  },
  { key: "order_processed" },
);
```

### Custom Messenger Implementation

```typescript
class EmailMessenger extends Messenger<EmailPayload> {
  constructor(private emailService: EmailService) {
    super(["customer", "admin"]);
  }

  async send(messageKey: string, recipientRoles: string[]): Promise<void> {
    const message = this.getMessage(messageKey);
    if (!message) throw new Error(`Message ${messageKey} not found`);

    for (const role of recipientRoles) {
      await this.emailService.send({
        to: this.getRecipientsForRole(role),
        subject: message.message.subject,
        body: message.message.body,
      });
    }
  }
}

// Register custom messages
emailMessenger.registerMessage(
  new Message("welcome_email", {
    subject: "Welcome!",
    body: "Thanks for joining!",
  }),
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

// Avoid
interface IState {
  key: string;
  data: {
    user: {
      personal: {
        contact: {
          email: string;
          phone: string;
        };
        preferences: {
          notifications: boolean;
          theme: "light" | "dark";
        };
      };
    };
  };
}
```

### 2. Action Design

- Actions should be atomic and focused
- Return consistent result structure
- Handle all error cases
- Use descriptive messages

```typescript
// Good action design
const action = new Action(
  "send_notification",
  "Sends notification to user",
  (state) => state.key === "ready_to_notify",
  async (state) => {
    const result = await notificationService.send({
      recipient: state.data.userId,
      message: state.data.message,
      type: state.data.notificationType,
    });

    return {
      success: result.success,
      message: result.success
        ? "Notification sent successfully"
        : `Failed to send: ${result.error}`,
      cost: result.cost || 0,
      new_state: result.success
        ? {
            key: "notification_sent",
            data: {
              ...state.data,
              sentAt: new Date(),
              notificationId: result.id,
            },
          }
        : {
            key: "notification_failed",
            data: {
              ...state.data,
              error: result.error,
              failedAt: new Date(),
            },
          },
    };
  },
);
```

### 3. Event Design

- Use descriptive event keys
- Include relevant payload data
- Document event purposes

```typescript
// Good event design
const events = {
  USER_REGISTERED: "user_registered",
  EMAIL_VERIFIED: "email_verified",
  ORDER_PLACED: "order_placed",
  PAYMENT_PROCESSED: "payment_processed",
};

// With payloads
await orchestrator.handleEvent(taskId, {
  key: events.USER_REGISTERED,
  payload: {
    userId: "user_123",
    email: "user@example.com",
    registrationSource: "web",
  },
});
```

### 4. Testing

- Test actions independently
- Test workflow transitions
- Mock external dependencies
- Test error scenarios

```typescript
// Example test
describe("User Onboarding Workflow", () => {
  let task: ITask;

  beforeEach(async () => {
    task = await orchestrator.initTask("user-onboarding", {
      email: "test@example.com",
    });
  });

  it("should send verification email", async () => {
    const result = await orchestrator.handleEvent(task.id, {
      key: "user_registered",
    });

    expect(result).toHaveLength(1);
    expect(result[0].success).toBe(true);
    expect(result[0].action_log_data?.new_state?.key).toBe("verification_sent");
  });
});
```

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
await orchestrator.handleEvent(taskId, { key: "verify_email" });

// Queries (inspect state)
const currentState = await orchestrator.getTask(taskId);
console.log(currentState.state.key);
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
      state: task.state,
      updatedAt: new Date(),
    });
  }

  protected async persistInvocationLog(log: IInvocationLog): Promise<void> {
    await this.db.logs.insert(log);
  }
}
```

### External Service Integration

```typescript
class SlackMessenger extends Messenger<SlackMessage> {
  constructor(private slackClient: SlackClient) {
    super(["channel", "dm"]);
  }

  async send(messageKey: string, recipientRoles: string[]): Promise<void> {
    const message = this.getMessage(messageKey);

    for (const role of recipientRoles) {
      if (role === "channel") {
        await this.slackClient.postMessage(message.message);
      } else if (role === "dm") {
        await this.slackClient.sendDM(message.message);
      }
    }
  }
}
```

## API Reference

### Core Classes

#### `Orchestrator`

Abstract base class for workflow orchestration.

**Methods:**

- `registerWorkflow(workflow: Workflow): void`
- `getWorkflows(): Workflow[]`
- `getWorkflow(workflowKey: string): Workflow | undefined`
- `initTask(workflowKey: string, initialData?: Record<string, any>): Promise<ITask>`
- `getTasks(): Promise<ITask[]>`
- `getTask(taskId: string): Promise<ITask | undefined | null>`
- `handleEvent(taskId: string, event: IEvent): Promise<IInvocationLog[]>`

#### `Workflow`

Manages actions and state transitions within a workflow.

**Methods:**

- `setInitialStateData(data: Record<string, unknown>): void`
- `initState(): void`
- `getState(): IState | undefined`
- `setState(state: IState): void`
- `registerAction(action: Action): void`
- `addTrigger(eventKey, action, condition?): void`
- `handleEvent(event, messenger?): Promise<IActionLogData>`
- `getActions(): Action[]`
- `setTaskId(taskId: string): void`
- `getTaskId(): string | undefined`

#### `Action`

Represents an atomic operation within a workflow.

**Methods:**

- `canBeInvoked(state: IState): TCanBeInvoked`
- `invoke(state, taskId?, event?, messenger?): Promise<IActionLogData>`

#### `Message<T>`

Represents a message with key and payload.

**Methods:**

- `getKey(): string`
- `getMessage(): T`
- `toObject(): { key: string; message: T }`

#### `Messenger<T>`

Abstract base class for message delivery.

**Methods:**

- `registerMessage(message: Message<T>): void`
- `getMessage(key: string): Message<T> | undefined`
- `send(messageKey, recipientRoles): Promise<void>` (abstract)

### Core Types

#### `IState`

```typescript
interface IState {
  key: string;
  data: Record<string, any>;
}
```

#### `ITask`

```typescript
interface ITask {
  id: string;
  workflowKey: string;
  state: IState;
  createdAt: Date;
}
```

#### `IEvent`

```typescript
interface IEvent {
  key: TEventKey;
  payload?: Record<string, any>;
}
```

#### `IActionLogData`

```typescript
interface IActionLogData {
  action_key?: string;
  cost: number;
  success: boolean;
  message?: string;
  data?: Record<string, any>;
  new_state?: IState;
  emitEvent?: IEmitEvent;
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
