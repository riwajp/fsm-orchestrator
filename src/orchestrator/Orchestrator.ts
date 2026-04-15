import { Messenger } from "../messaging";
import { randomUUID } from "crypto";
import { Workflow } from "./Workflow";
import type { IState } from "../types/memory";
import type { IEvent, ITask, ISubtask } from "../types";
import type { IInvocationLog } from "../types/logs";

export abstract class Orchestrator {
  protected messenger?: Messenger<any>;

  protected workflows: Workflow[] = [];
  protected tasks: ITask[] = [];
  protected logs: IInvocationLog[] = [];

  /**
   * Persist the current state of a task.
   * Implementations can store this in any durable medium (DB, file, etc.).
   */
  protected abstract persistTaskState(task: ITask): void;

  /**
   * Persist a single invocation log.
   * Implementations can store this in any durable medium (DB, file, etc.).
   */
  protected abstract persistInvocationLog(log: IInvocationLog): void;

  /**
   * Handle learning data returned by actions.
   * Implementations should handle DB updates, fetching learning, etc.
   */
  protected abstract learn(learningData: { key: string; data: any }): void | Promise<void>;

  constructor(
    key: string,
    workflows: Workflow[] = [],
    messenger?: Messenger<any>,
  ) {
    this.workflows = workflows;
    this.messenger = messenger;
    this.logs = [];
  }

  /* ---------- Workflow Management ---------- */

  public registerWorkflow(workflow: Workflow): void {
    this.workflows.push(workflow);
  }

  public getWorkflows(): Workflow[] {
    return this.workflows;
  }

  public getWorkflow(workflowKey: string): Workflow | undefined {
    return this.workflows.find((w) => w.key === workflowKey);
  }

  /* ---------- Task Management ---------- */

  public async initTask(
    taskInitialData: Record<string, any>,
    subtaskWorkflowKey: string,
    subtaskInitialData?: Record<string, any>,
  ): Promise<ITask> {
    const workflow = this.getWorkflow(subtaskWorkflowKey);
    if (!workflow)
      throw new Error(`Workflow '${subtaskWorkflowKey}' not found`);

    const taskId = randomUUID();
    const globalState: IState = {
      key: "initial",
      data: taskInitialData,
    };

    const initialSubtask: ISubtask = {
      id: randomUUID(),
      workflowKey: subtaskWorkflowKey,
      localState: {
        key: workflow.initialStateKey,
        data: subtaskInitialData ?? {},
      },
      createdAt: new Date(),
      status: "active",
    };

    const task: ITask = {
      id: taskId,
      globalState: globalState,
      subtasks: [initialSubtask],
      createdAt: new Date(),
    };

    this.tasks.push(task);
    await this.persistTaskState(task);
    return task;
  }

  /**
   * Persist a task's current state to durable storage.
   * Useful when task data is mutated outside of handleEvent.
   */
  public async persistTask(task: ITask): Promise<void> {
    await this.persistTaskState(task);
  }

  public async getTasks(): Promise<ITask[]> {
    return this.tasks;
  }

  public async getTask(taskId: string): Promise<ITask | undefined | null> {
    return this.tasks.find((t) => t.id === taskId);
  }

  public async listActiveSubtasks(taskId: string): Promise<ISubtask[]> {
    const task = await this.getTask(taskId);
    if (!task) throw new Error(`Task '${taskId}' not found`);
    return task.subtasks.filter((s) => s.status === "active");
  }

  /* ---------- Event Handling ---------- */

  public async handleEvent(
    taskId: string,
    subtaskId: string,
    event: IEvent,
  ): Promise<IInvocationLog[]> {
    const current_invocation_logs = [];

    const task = await this.getTask(taskId);
    if (!task) {
      return [
        {
          success: false,
          message: `Task '${taskId}' not found`,
          task_id: taskId,
          event: event,
          timestamp: new Date().toISOString(),
        },
      ];
    }

    const subtask = task.subtasks.find((s) => s.id === subtaskId);
    if (!subtask) {
      return [
        {
          success: false,
          message: `Subtask '${subtaskId}' not found in task '${taskId}'`,
          task_id: taskId,
          event: event,
          timestamp: new Date().toISOString(),
        },
      ];
    }

    if (subtask.status !== "active") {
      return [
        {
          success: false,
          message: `Subtask '${subtaskId}' is already completed`,
          task_id: taskId,
          event: event,
          timestamp: new Date().toISOString(),
        },
      ];
    }

    const workflow = this.getWorkflow(subtask.workflowKey);
    if (!workflow) {
      return [
        {
          success: false,
          message: `Workflow '${subtask.workflowKey}' not found for subtask`,
          task_id: task.id,
          event: event,
          timestamp: new Date().toISOString(),
        },
      ];
    }

    const result = await workflow.handleEvent(
      event,
      subtask.localState,
      task.globalState,
      task.id,
      subtask.id,
      this.messenger,
    );

    if (result.success) {
      // Update local state
      subtask.localState = result.new_state ?? subtask.localState;

      // Update global state if provided
      if (result.new_global_state) {
        task.globalState = result.new_global_state;
      }

      // Handle subtask termination
      if (result.end_subtask) {
        subtask.status = "completed";
      }

      // Handle subtask spawning
      if (result.spawn_subtask) {
        const spawnWorkflow = this.getWorkflow(result.spawn_subtask.workflowKey);
        if (spawnWorkflow) {
          const newSubtask: ISubtask = {
            id: randomUUID(),
            workflowKey: spawnWorkflow.key,
            localState: {
              key: spawnWorkflow.initialStateKey,
              data: result.spawn_subtask.initialData ?? {},
            },
            createdAt: new Date(),
            status: "active",
          };
          task.subtasks.push(newSubtask);
        }
      }

      await this.persistTaskState(task);
    }

    if (result.learningData) {
      await this.learn(result.learningData);
    }

    const invocation_log: IInvocationLog = {
      action_log_data: result,
      task_id: task.id,
      event: event,
      success: !!result.action_key,
      timestamp: new Date().toISOString(),
    };

    this.logs.push(invocation_log);
    this.persistInvocationLog(invocation_log);
    current_invocation_logs.push(invocation_log);

    if (result.success && result.action_key && result.emitEvent) {
      const nextEvent: IEvent = {
        key: result.emitEvent.key,
        payload: result.emitEvent.buildPayload?.(result) ?? {},
      };

      // recursively trigger next event
      // Note: We recursively trigger on the SAME subtask.
      // If the action spawned a new subtask, events for that subtask should be handled separately
      // unless we want to support targetting subtasks in emitEvent.
      await this.handleEvent(task.id, subtask.id, nextEvent);
    }

    return current_invocation_logs;
  }
}
