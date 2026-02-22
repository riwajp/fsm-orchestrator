# Orchestrator

A lightweight TypeScript library of primitives for building an AI co‑worker orchestration platform. This repository contains modular building blocks you can use to compose event-driven workflows, maintain memory and logs, map events to actions, and send messages to recipients via pluggable transports.

This README describes the project layout, installation and build steps, public API overview, examples, and contribution guidelines.

---

Table of contents

- Project layout
- Install & build
- Key concepts & modules
- Examples
  - Memory + Compass usage
  - Implementing a simple ConsoleMessenger
  - Wiring a concrete Orchestrator
- Tests & quality
- Contributing
- License

---

Project layout

```
orchestrator/
├─ src/
│  ├─ action/Action.ts           # Action base class
│  ├─ message/Message.ts         # Small keyed message container (internal)
│  ├─ messaging/
│  │  ├─ Message.ts              # Transport-level message (if present)
│  │  └─ Messenger.ts            # Abstract messenger transport
│  ├─ memory/
│  │  ├─ Memory.ts               # Memory, log, identity
│  │  └─ Queue.ts                # Simple FIFO queue for events
│  ├─ orchestrator/
│  │  ├─ Compass.ts              # Map events -> actions + conditions
│  │  └─ Orchestrator.ts         # Abstract orchestrator core (memory, compass, messenger)
│  ├─ types/
│  │  └─ ...                     # Domain types (IEvent, TState, etc.)
│  └─ index.ts                   # Root public exports (barrel)
├─ package.json
├─ tsconfig.json
└─ README.md
```

---

Install & build

- Ensure Node.js (or Bun) and TypeScript are available.
- Install dependencies:
  - npm: `npm install`
  - bun: `bun install`
- Build (if you want compiled output):
  - `tsc --build` (or use your bundler)

---

Key concepts & modules

- Memory (`src/memory/Memory.ts`)
  - Keeps an in-memory state object, timestamped log entries, a FIFO queue, and an identity (system prompt).
  - API highlights:
    - `getState(key?)`, `setState(key, value)`
    - `addLog(event, data?)`
    - `getQueue()`, `getIdentity()`, `setIdentity()`

- Queue (`src/memory/Queue.ts`)
  - Simple FIFO queue with `enqueue`, `dequeue`, `peek`, `isEmpty`, `size`.

- Compass (`src/orchestrator/Compass.ts`)
  - Holds possible events and registered actions.
  - Allows registering conditional mappings: for eventKey, attach (action, condition) pairs.
  - Produces the list of candidate actions for an event by evaluating conditions.

- Action (`src/action/Action.ts`)
  - Abstract base class describing an action (key, description, transitions).
  - Implementers provide `canBeInvoked(state)` and `perform(state)`.

- Messaging
  - `src/messaging/Messenger.ts` — Abstract messenger storing keyed messages and exposing a `send(...)` API. Implement transports by extending this class (Console, Slack, SMTP, HTTP, LLM proxy, etc.). Consider making `send` return `Promise<void>` for async transports.
  - `src/message/Message.ts` — Minimal keyed payload used across the repo.

- Orchestrator (`src/orchestrator/Orchestrator.ts`)
  - Core runtime that wires Memory and Compass and optionally accepts a Messenger.
  - Responsibilities:
    - Load/save memory from persistent sources (abstract methods).
    - Handle events: log the event, query Compass for actions, run the first actionable action, update memory, and log failures.
    - Exposes `setMessenger/getMessenger` to plug a concrete messenger.

- Root exports (`src/index.ts`)
  - Barrel file that re-exports the main public modules for convenient imports from the package root.

---

Examples

1. Memory + Compass quick example

```ts
import { Memory } from "./src/memory/Memory";
import { Compass } from "./src/orchestrator/Compass";
import { Action } from "./src/action/Action";
import type { IEvent } from "./src/types/memory";

// Minimal example of creating memory and compass
const memory = new Memory("assistant-identity");

const compass = new Compass();

// Example event definition
const sampleEvent: IEvent = { key: "user_signup", payload: { userId: "u1" } };

// Example action (implement the abstract methods in a concrete class)
class LogAction extends Action {
  constructor() {
    super("log_action", "Log something", {});
  }
  canBeInvoked(state: any) {
    return { can: true as const };
  }
  async perform(state: any) {
    // perform side-effect, update state
    return { key: "stateKey", data: {} };
  }
}

const act = new LogAction();
compass.registerAction(act);
compass.addCondition("user_signup", act, (event) => !!event.payload.userId);

// Query actions for event:
const actions = compass.getActionsForEvent(sampleEvent);
console.log(
  "Actions for event:",
  actions.map((a) => a.key),
);
```

2. Implementing a simple `ConsoleMessenger`

```ts
// src/example/ConsoleMessenger.ts
import { Messenger } from "../src/messaging/Messenger";
import { Message } from "../src/message/Message";

class ConsoleMessenger extends Messenger<any> {
  // If your base Messenger defines send as async, return Promise<void>.
  async send(messageKey: string, recipientRoles: string[]): Promise<void> {
    const msg = this.getMessage(messageKey);
    if (!msg) throw new Error(`Message not found: ${messageKey}`);
    // example delivery: console output
    console.log(
      `[ConsoleMessenger] sending to:`,
      recipientRoles,
      "payload:",
      msg.getMessage(),
    );
  }
}

// Usage
const m = new ConsoleMessenger();
m.registerMessage(new Message("welcome", { text: "Hello" }));
await m.send("welcome", ["user"]);
```

3. Wiring a concrete Orchestrator

- Create a subclass of `Orchestrator` and implement `loadMemoryFromSource` and `saveMemoryToSource`.
- Optionally construct and set a `Messenger` instance via `setMessenger()` for outgoing messages.

```ts
import { Orchestrator } from "./src/orchestrator/Orchestrator";
import { Memory } from "./src/memory/Memory";

class MyOrchestrator extends Orchestrator {
  async loadMemoryFromSource(): Promise<Memory> {
    // load from disk/db or return a new Memory
    return new Memory("assistant-identity");
  }
  async saveMemoryToSource(memory: Memory): Promise<void> {
    // persist memory
  }
}
```

---

Tests & quality

- There are no committed test suites in this repository by default. To add tests:
  - Choose a test runner (e.g., Vitest, Jest).
  - Add unit tests for `Memory`, `Compass`, `Messenger` implementations, and `Orchestrator` subclasses.
  - Ensure `tsconfig.json` includes `declaration` and appropriate module targets for library consumers.

- Linting/formatting
  - Add `eslint` / `prettier` to enforce style and catch common bugs.
  - Consider enabling strict TypeScript compiler options to surface type issues early.

---

Contributing

Thanks for considering contributions. Suggested process:

1. Open an issue to discuss major changes or feature ideas.
2. Create a branch off `main` for your work.
3. Keep PRs focused and small. Document the intent and any breaking changes.
4. Run or add tests for your changes.
5. Maintain backward compatibility where reasonable. If breaking changes are necessary, document them in the changelog.

Areas where contributions are welcome:

- Concrete messenger adapters (Slack, SMTP, webhook, LLM proxy).
- Test coverage and CI setup.
- Type tightening and clearer domain models.
- Example orchestrator implementations and demos.

---

TODO / potential improvements

- Consolidate multiple `Message` types (rename transport message to `TransportMessage` if both concepts are needed).
- Make `Messenger.send` consistently async across the codebase.
- Provide a simple reference concrete messenger (Console) inside `src/messaging` for testing.
- Add an examples/ directory with runnable demos.

---

License

Licensed under the MIT License — see the repository `LICENSE` file.

If you'd like, I can:

- make `Messenger.send` asynchronous across the repo,
- add a `ConsoleMessenger` example in the `src/` tree,
- add a basic test suite and CI config.

Which of these should I implement next?
