# FSM Orchestrator

A generic, extensible state machine orchestrator for managing workflows, transitions, and actions in TypeScript/JavaScript projects.

## Features

- **State Machine Management:** Define statuses, transitions, and final states.
- **Action Dispatching:** Register and execute actions with custom logic and memory updates.
- **Persistent Logging:** Track all actions performed with timestamped logs.
- **Extensible Memory:** Store and update workflow state and memory as needed.
- **Pluggable Persistence:** Optionally persist state to external storage.

## Installation

```bash
bun install orchestrator
# or with npm
npm install orchestrator
```

## Usage

```typescript
import { Orchestrator, Action, TTransitionTable } from "orchestrator";

// Define statuses and memory type
type Status = "idle" | "running" | "done";
interface Memory {
  count: number;
}

// Define transition table
const transitions: TTransitionTable<Status> = {
  idle: { start: "running" },
  running: { finish: "done", stop: "idle" },
  done: {},
};

// Create orchestrator instance
const orchestrator = new Orchestrator<Status, Memory>(
  { count: 0 },
  {
    initialStatus: "idle",
    finalStatuses: ["done"],
    transitions,
    handlePersistentStorage: (status, memory, logs) => {
      // Persist state as needed
    },
  },
);

// Register actions
orchestrator.addAction(
  new Action<Status, Memory>({
    key: "start",
    execute: (status, memory) => ({
      memory: { count: (memory.count ?? 0) + 1 },
    }),
    generateLog: () => "Started workflow.",
  }),
);

// Dispatch actions
await orchestrator.dispatch("start");
console.log(orchestrator.status); // "running"
console.log(orchestrator.memory); // { count: 1 }
console.log(orchestrator.logs); // Array of logs
```

## API

### Orchestrator

```typescript
new Orchestrator<TStatus, TMemory>(memory, options);
```

- `memory`: Initial memory/state object.
- `options`:
  - `initialStatus`: Starting status.
  - `finalStatuses`: Array of final statuses.
  - `transitions`: Transition table.
  - `handlePersistentStorage`: Optional callback for persistence.

#### Methods

- `addAction(action)`: Register an action.
- `dispatch(actionKey)`: Execute an action and transition state.
- `isFinalStatus()`: Check if current status is final.
- `updateMemory(partial)`: Merge partial memory update.
- `logs`: Get action logs.

### Action

```typescript
new Action<TStatus, TMemory>({ key, execute, generateLog });
```

- `key`: Unique identifier for the action.
- `execute`: Function to perform the action.
- `generateLog`: Function to generate a log message.

### TransitionTable

```typescript
type TTransitionTable<TStatus> = {
  [From in TStatus]?: { [ActionKey: string]: TStatus };
};
```

## Contributing

Contributions are welcome! Please open issues or submit pull requests for improvements or bug fixes.

## License

MIT

---

This project was created using `bun init` in bun v1.2.18. [Bun](https://bun.sh) is a fast all-in-one JavaScript runtime.
