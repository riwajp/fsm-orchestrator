## Orchestrator – multi‑workflow event engine for AI co‑workers

This library provides a **small set of primitives for building event‑driven, multi‑workflow orchestrators**.  
You wire together **workflows** composed of **actions**, feed them **events**, and optionally plug in a **messenger** to talk to the outside world (LLMs, users, services, etc.).

The core ideas are:

- **Action** – a unit of work that:
  - decides if it **can run** given the current state,
  - **executes** some logic,
  - **returns the next state** and optionally **emits a new event**.
- **Workflow** – a finite state machine that:
  - owns a **state**,
  - registers **actions**,
  - defines **triggers**: “when event X happens and condition C holds, try action A”.
- **Orchestrator** – a runtime that:
  - manages **multiple workflows and tasks**,
  - receives **events for a given task**,
  - routes them to the correct workflow,
  - **recursively follows emitted events** until the chain is complete,
  - keeps a **structured log** of everything that happened.

This README explains:

- **Architecture** of the system and data flow.
- **Action**, **Workflow**, and **Orchestrator** in detail.
- How to **build a multi‑workflow orchestrator for AI agents**.
- How to **work with events, tasks, and logs**.

---

### Table of contents

- **Project layout**
- **Installation & build**
- **Core architecture**
  - State & memory types
  - Events & triggers
  - Actions
  - Workflows
  - Orchestrator
  - Messenger & messages
  - Logs & observability
- **Designing multi‑workflow agents**
  - Representing workflows as FSMs
  - Wiring multiple workflows into one orchestrator
  - Event chaining across workflows
- **Code examples**
  - Defining an `Action`
  - Defining a `Workflow`
  - Building a multi‑workflow `Orchestrator`
- **Tests & quality**
- **Contributing**
- **License**

---

### Project layout

The important parts of the repo look like this:

```text
orchestrator/
├─ src/
│  ├─ action/
│  │  └─ Action.ts           # Concrete Action class
│  ├─ messaging/
│  │  └─ Messenger.ts        # Abstract message transport
│  ├─ orchestrator/
│  │  ├─ Orchestrator.ts     # Abstract multi‑workflow orchestrator core
│  │  └─ index.ts            # Public exports for orchestrator pieces
│  ├─ types/
│  │  ├─ action.ts           # TCanBeInvoked, IEmitEvent
│  │  ├─ logs.ts             # IActionLogData, IInvocationLog
│  │  ├─ memory.ts           # IState, TIdentity
│  │  ├─ workflow.ts         # ITask, IEvent, ITrigger, etc.
│  │  └─ index.ts            # Barrel for types
│  └─ index.ts               # Root public exports
├─ examples/
│  └─ procurement/
│     └─ orchestrator.ts     # Example ProcurementOrchestrator using a workflow
├─ package.json
├─ tsconfig.json
└─ README.md
```

The library is published as **`fsm-orchestrator`** (see `package.json`).

---

### Installation & build

- **Peer dependency**: TypeScript ^5
- **Runtime dependency**: `uuid` (for task IDs)

- **Install**:
  - npm: `npm install fsm-orchestrator`
  - bun (in this repo): `bun install`

- **Build (from source)**:
  - `bun run build` (or simply `tsc` if you prefer)

You will typically **import from the published package** in your own project, e.g.:

```ts
import Orchestrator, { Workflow } from "fsm-orchestrator/src/orchestrator";
import { Action } from "fsm-orchestrator/src/action/Action";
import type { IEvent, ITask } from "fsm-orchestrator/src/types";
```

(Adjust paths based on how you consume the package; the exports are intentionally simple.)

---

## Core architecture

At a high level, the orchestrator implements an **event → workflow → action → state transition → (optional) next event** loop.

Events are always processed **in the context of a task**, and each task is tied to a **single workflow**.  
However, an orchestrator instance can own **many workflows and many tasks** at once.

### State & memory (`IState`, `TIdentity`)

- **`IState`** (in `src/types/memory.ts`) models the current state of a workflow:

```ts
export type IState = {
  key: string;                // e.g. "draft", "waiting_for_approval", "completed"
  data: Record<string, any>;  // arbitrary structured data
};
```

- **`TIdentity`** is a simple string for describing an agent’s “system prompt” or identity if you want to layer LLM semantics on top.  
  The orchestrator itself doesn’t enforce any semantics here; it’s available as a building block.

### Events & triggers (`IEvent`, `ITrigger`)

Events are **simple, typed messages** that say “something happened”:

```ts
export type TEventKey = string;

export interface IEvent {
  key: TEventKey;                   // e.g. "user_submitted_form"
  payload?: Record<string, any>;    // arbitrary event data
}
```

Inside a `Workflow`, we maintain **triggers**:

```ts
export interface IEventAction {
  action: Action;
  condition: (state: IState, event: IEvent) => boolean;
}

export interface ITrigger {
  [eventKey: TEventKey]: IEventAction[];
}
```

- For each **event key**, you can register one or more **(action, condition)** pairs.
- When the workflow receives an `IEvent`, it:
  - finds the list of candidate `IEventAction`s for that `event.key`,
  - evaluates each `condition(state, event)`,
  - for the **first action** whose condition passes and `canBeInvoked` returns `can: true`, it **executes** that action.

This gives you a very explicit, inspectable **event → action routing table** per workflow.

### Actions (`Action`)

File: `src/action/Action.ts`

An `Action` is a **concrete unit of work**. It is configurable with:

- **`key: string`** – unique identifier within a workflow.
- **`description: string`** – human‑readable summary, great for tool descriptions in LLM systems.
- **`canBeInvoked(state: IState) => TCanBeInvoked`** – a guard that says whether the action is currently allowed.
- **`invoke(state: IState, messenger?: Messenger<any>) => IActionLogData`** – the actual logic that:
  - inspects `state` (and possibly sends messages),
  - computes the **next state**,
  - optionally **emits a follow‑up event**.

The type `TCanBeInvoked` is:

```ts
export type TCanBeInvoked = {
  can: boolean;
  description: string;  // why it can/can’t be invoked
};
```

The action implementation looks like this at the type level:

```ts
new Action(
  key,                       // string
  description,               // string
  canBeInvokedFn,            // (state: IState) => TCanBeInvoked
  invokeFn,                  // (state: IState, messenger?: Messenger<any>) => IActionLogData | Promise<IActionLogData>
  emitEvent?                 // optional IEmitEvent describing the next event to emit
);
```

Where `IEmitEvent` is:

```ts
export type IEmitEvent = {
  key: string;                               // event key to emit after success
  buildPayload: (log: IActionLogData) => any // how to build its payload from the action result
};
```

**Execution contract**:

- When you call `Action.invoke(state, messenger)`:
  - the library attaches:
    - `result.action_key = this.key`
    - `result.emitEvent = this.emitEvent`
  - and returns an `IActionLogData` object:

```ts
export interface IActionLogData {
  action_key?: string;
  cost: number;
  success: boolean;
  message?: string;
  data?: Record<string, any>;
  new_state?: IState;
  emitEvent?: IEmitEvent;
}
```

Think of this as **“a structured log of what my action just did”**.

### Workflows (`Workflow`)

File: `src/orchestrator/Workflow.ts`

A `Workflow` represents **one finite state machine**:

- It has a **key** (`workflow.key`).
- It knows its **initial state key**.
- It keeps its own **current `IState`**.
- It owns:
  - a map of **actions** by key,
  - a map of **triggers** (`ITrigger`) describing which actions react to which events.

Key responsibilities:

- **State management**
  - `setInitialStateData(data)` / `initState()` – define and initialize the starting `IState`.
  - `getState()` / `setState()` – read/write the current state.

- **Action registration**
  - `registerAction(action)` – adds an action to the workflow.
    - Enforces **unique keys** per workflow.

- **Trigger registration**
  - `addTrigger(eventKey, action, condition)`:
    - registers the action (if not already present),
    - associates `(action, condition)` with the given `eventKey`,
    - rejects duplicate triggers for the same event + action combination.

- **Event handling**
  - `handleEvent(event, messenger?)`:
    - validates `this.state` exists,
    - finds triggers for `event.key`,
    - for each candidate **in order**:
      - checks `condition(state, event)`,
      - calls `action.canBeInvoked(state)`,
      - if both pass, runs `action.invoke(state, messenger)`,
      - if `result.success` is true and `result.new_state` is present, updates `this.state`,
      - returns that `IActionLogData`.
    - If no action can run, returns a **failure log** explaining why.

In other words, **a workflow is the local brain** that says:

> “Given my current state and this event, which action should run next, and what does that do to my state?”

### Orchestrator (`Orchestrator`)

File: `src/orchestrator/Orchestrator.ts`

The `Orchestrator` coordinates **multiple workflows and multiple tasks**.

Conceptually:

- A **workflow** describes *how* a process evolves.
- A **task** is a *single running instance* of a workflow:

```ts
export type ITask = {
  id: string;         // generated with uuid
  workflowKey: string;
  state: IState;
  createdAt: Date;
};
```

The orchestrator maintains:

- `workflows: Workflow[]` – the workflows it can use.
- `tasks: ITask[]` – the active tasks it is tracking.
- `logs: IInvocationLog[]` – a history of all action invocations.
- Optional `messenger?: Messenger<any>` – for side‑effectful communication.

#### Workflow management

- **`registerWorkflow(workflow: Workflow)`** – add a workflow.
- **`getWorkflows()`** – list all registered workflows.
- **`getWorkflow(key: string)`** – look up a single workflow.

#### Task lifecycle

- **`initTask(workflowKey: string, initialData?: Record<string, any>): ITask`**
  - Looks up the workflow by key.
  - Optionally calls `workflow.setInitialStateData(initialData)`.
  - Calls `workflow.initState()`.
  - Creates a new `ITask`:
    - Assigns `uuidv4()` as `id`.
    - Stores `workflowKey`, initial `state`, and `createdAt`.
  - Stores it in `this.tasks` and returns it.

- **`getTasks()`** – list all tasks.
- **`getTask(taskId: string)`** – find a specific task by ID.

Each task is **bound to exactly one workflow**, but a single orchestrator can manage many tasks for many workflows at once.

#### Event handling & recursion

The heart of the orchestrator is:

- **`handleEvent(taskId: string, event: IEvent): Promise<IInvocationLog[]>`**

Execution flow:

1. **Locate the task** by `taskId`.
   - If not found, return a single failure `IInvocationLog`.
2. **Locate the workflow** bound to that task.
   - If not found, return a single failure `IInvocationLog`.
3. **Inject the task’s current state** into the workflow via `workflow.setState(task.state)`.
4. **Delegate the event** to the workflow:
   - `const result = await workflow.handleEvent(event, this.messenger);`
5. **Update the task state**:
   - if `result.success` is true and `result.new_state` exists, update `task.state`.
6. **Create an invocation log entry**:

```ts
export interface IInvocationLog {
  timestamp: string;
  task_id: string;
  success: boolean;
  message?: string;
  event: IEvent;
  action_log_data?: IActionLogData;
}
```

7. **Append the log** to `this.logs` and include it in the return array.
8. **If the action emitted an event**, recursively continue:
   - If `result.success && result.action_key && result.emitEvent`:
     - Build `nextEvent` from `emitEvent.key` and `emitEvent.buildPayload(result)`.
     - Call `await this.handleEvent(task.id, nextEvent)` again.

This gives you a **chain of events and actions**, all within the same task and workflow, until:

- An action fails.
- No action can handle the current event.
- An action doesn’t emit any follow‑up event.

The **array of `IInvocationLog`s returned** from the public `handleEvent` call contains **only the logs from the first event handling call** (the current implementation returns the logs for the current invocation, while recursive calls maintain overall state and append to `this.logs`). You can inspect **`this.logs`** for the full history of a task across events.

### Messenger & messages (`Messenger`)

File: `src/messaging/Messenger.ts`

`Messenger` is an **abstract base class** for sending messages to external systems:

```ts
export abstract class Messenger<T> {
  protected recipientRoles: string[];
  protected messages: Map<string, Message<T>>;

  constructor(recipientRoles: string[] = []) { /* ... */ }

  registerMessage(message: Message<T>): void { /* ... */ }

  protected getMessage(key: string): Message<T> | undefined { /* ... */ }

  abstract send(messageKey: string, recipientRoles: string[]): void;
}
```

Actions receive an optional `Messenger` instance when they are invoked:

- You can use it to:
  - send notifications,
  - call LLMs,
  - dispatch emails or webhooks,
  - log structured content elsewhere.

Because `send` is abstract and untyped on side effects, you are free to:

- keep it **synchronous** for simple transports, or
- make it **asynchronous** in a subclass (`Promise<void>`) and wire that into your `invoke` functions.

---

## Designing multi‑workflow agents

Multi‑workflow agents are built by:

- Defining **one workflow per major process** (e.g. “RFQ procurement”, “contract negotiation”, “vendor onboarding”).
- Implementing **actions** inside each workflow that:
  - encapsulate a clear unit of work (LLM call, API call, transformation, etc.),
  - optionally emit follow‑up events to continue the process.
- Wiring those workflows into an **Orchestrator subclass**, which:
  - registers all workflows in its constructor,
  - exposes application‑specific helpers for creating tasks and feeding events.

### 1. Represent workflows as finite state machines

For each process, choose:

- **States** (`IState.key`):
  - Example for an RFQ workflow: `"rfq_draft"`, `"rfq_sent"`, `"waiting_for_responses"`, `"evaluating_quotes"`, `"rfq_closed"`.
- **Events** (`IEvent.key`):
  - Example: `"user_created_rfq"`, `"rfq_sent_to_vendors"`, `"vendor_submitted_quote"`, `"user_selected_vendor"`.
- **Actions**:
  - Each action should map from **(current state, event)** to **(next state, side effects, emitted event)**.

Then, create a `Workflow` with:

- A `key` (e.g. `"rfq_procurement"`).
- An `initialStateKey` (e.g. `"rfq_draft"`).
- Registered actions and triggers for each relevant event.

### 2. Wiring multiple workflows into one orchestrator

An orchestrator can manage **many workflows**:

- E.g. `rfqProcurementWorkflow`, `contractWorkflow`, `vendorOnboardingWorkflow`.
- In your `Orchestrator` subclass constructor:
  - instantiate all workflows,
  - pass them to `super("MyOrchestratorKey", [workflowA, workflowB, ...])`.

Each **task** is tied to one specific workflow:

- Use `orchestrator.initTask("rfq_procurement", { /* initial data */ })` to start a task in that workflow.
- Later, feed events into that task via `orchestrator.handleEvent(task.id, someEvent)`.

You can maintain **parallel tasks** across multiple workflows:

- E.g. one task in `"rfq_procurement"` and another in `"contract_negotiation"`, both driven by different agents or inputs but orchestrated by the same runtime.

### 3. Event chaining across workflows

The current implementation **chains events recursively within a single workflow**:

- An action can emit an event via `emitEvent` on the `IActionLogData`.
- The orchestrator will **recursively call `handleEvent`** for the same task.

If you want to **bridge workflows** (e.g. when an RFQ closes, automatically start a contract workflow), you can:

- Implement this in **application code** using the logs:
  - Observe that a task has reached some terminal state.
  - Manually call `initTask("contract_workflow", { /* data from RFQ state */ })`.
- Or encode cross‑workflow triggering in a higher‑level service that:
  - subscribes to `IInvocationLog`s,
  - creates new tasks / events accordingly.

This keeps the core library focused on **single‑workflow FSMs per task**, while still allowing **multi‑workflow orchestration at one level up**.

---

## Code examples

### Defining an `Action`

A minimal example of a **pure state transition** action:

```ts
import { Action } from "fsm-orchestrator/src/action/Action";
import type { IState } from "fsm-orchestrator/src/types/memory";
import type { IActionLogData } from "fsm-orchestrator/src/types/logs";
import type { Messenger } from "fsm-orchestrator/src/messaging/Messenger";

const approveRfqAction = new Action(
  "approve_rfq",
  "Approve an RFQ once all validations pass",
  (state: IState) => {
    const can = state.key === "rfq_draft" && !!state.data.validated;
    return {
      can,
      description: can
        ? "RFQ is ready to be approved"
        : "RFQ must be validated before approval",
    };
  },
  async (state: IState, messenger?: Messenger<any>): Promise<IActionLogData> => {
    // Optionally use messenger to notify stakeholders here
    // messenger?.send("rfq_approved", ["procurement_manager"]);

    const new_state: IState = {
      key: "rfq_approved",
      data: {
        ...state.data,
        approvedAt: new Date().toISOString(),
      },
    };

    return {
      success: true,
      cost: 0,
      message: "RFQ approved successfully",
      new_state,
      data: {}, // any extra structured data
    };
  },
  {
    key: "rfq_approved_event",
    buildPayload: (log) => ({
      rfqId: log.new_state?.data.rfqId,
      approvedAt: log.new_state?.data.approvedAt,
    }),
  },
);
```

### Defining a `Workflow`

```ts
import { Workflow } from "fsm-orchestrator/src/orchestrator";
import type { IState } from "fsm-orchestrator/src/types/memory";
import type { IEvent } from "fsm-orchestrator/src/types/workflow";
import { approveRfqAction } from "./actions"; // from previous example

// 1. Create the workflow with a key and initial state key
export const rfqProcurementWorkflow = new Workflow(
  "rfq_procurement",
  "rfq_draft",
);

// 2. Optionally set initial state data
rfqProcurementWorkflow.setInitialStateData({
  rfqId: undefined,
  items: [],
  validated: false,
});

// 3. Register triggers mapping events to actions
rfqProcurementWorkflow.addTrigger(
  "user_requested_approval", // event key
  approveRfqAction,          // action to run
  (state: IState, event: IEvent) => {
    // additional condition beyond canBeInvoked
    return state.key === "rfq_draft" && event.payload?.rfqId === state.data.rfqId;
  },
);
```

### Building a multi‑workflow `Orchestrator`

The repository includes an example in `examples/procurement/orchestrator.ts`:

```ts
import { Orchestrator } from "../../src/orchestrator/Orchestrator";
import { rfqProcurementWorkflow } from "./workflows";

export class ProcurementOrchestrator extends Orchestrator {
  constructor() {
    // Initialize with all workflows
    super("ProcurementAI", [rfqProcurementWorkflow]);
  }
}
```

In your application code:

```ts
const orchestrator = new ProcurementOrchestrator();

// 1. Create a task for a workflow
const task = orchestrator.initTask("rfq_procurement", {
  rfqId: "RFQ-123",
  items: [{ sku: "A-1", qty: 10 }],
  validated: true,
});

// 2. Send an event into that task
const logs = await orchestrator.handleEvent(task.id, {
  key: "user_requested_approval",
  payload: { rfqId: "RFQ-123" },
});

console.log("Invocation logs for this event:", logs);

// 3. Inspect the updated task state
console.log("Updated task:", orchestrator.getTask(task.id));
```

To extend this into a **multi‑workflow orchestrator**, simply:

- Define additional `Workflow` instances (e.g. `contractWorkflow`, `vendorOnboardingWorkflow`).
- Pass them all to your orchestrator’s `super` call:

```ts
super("ProcurementAI", [rfqProcurementWorkflow, contractWorkflow, vendorOnboardingWorkflow]);
```

Your orchestrator can then:

- spawn tasks in any workflow via `initTask(workflowKey, initialData)`,
- route events to the correct task/workflow via `handleEvent(taskId, event)`,
- maintain a unified log across all workflows and tasks.

---

### Tests & quality

- There is no bundled test suite yet; recommended steps:
  - Choose a test runner such as **Vitest** or **Jest**.
  - Add unit tests for:
    - `Action` behavior (`canBeInvoked`, `invoke`, `emitEvent`),
    - `Workflow.handleEvent` (trigger resolution and state transitions),
    - `Orchestrator.handleEvent` (task lifecycle, recursion, logging),
    - any concrete `Messenger` implementations.

- Linting / formatting:
  - Add `eslint` + `prettier` to your project as usual.
  - Enable strict TypeScript options (`strict: true`) when consuming the library for better type safety.

---

### Contributing

Thanks for considering contributing.

- **Before large changes**, please open an issue to discuss the design and how it fits the orchestration model.
- **PR guidelines**:
  - Keep PRs focused and small.
  - Document the intent, especially for breaking changes.
  - Add or update tests where applicable.
  - Maintain backward compatibility where practical.

Areas that are particularly welcome:

- Additional examples of **multi‑workflow orchestrators** (beyond procurement).
- Concrete `Messenger` subclasses (e.g. console, Slack, email, HTTP, LLM).
- Improvements to logging and observability around `IInvocationLog`.
- Higher‑level helpers for cross‑workflow orchestration.

---

### License

Licensed under the MIT License — see the repository `LICENSE` file.
