import { Messenger } from "../messaging";
import { v4 as uuidv4 } from "uuid";
import { Workflow } from "./Workflow";
import type { IEvent, IState } from "../types/memory";
import type { ITask } from "../types";
import type { IInvocationLog } from "../types/logs";

export abstract class Orchestrator {
  protected messenger?: Messenger<any>;

  protected workflows: Workflow[] = [];
  protected tasks: ITask[] = [];
  protected logs: IInvocationLog[] = [];

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

  public initTask(
    workflowKey: string,
    initialData?: Record<string, any>,
  ): ITask {
    const workflow = this.getWorkflow(workflowKey);
    if (!workflow) throw new Error(`Workflow '${workflowKey}' not found`);

    if (initialData) workflow.setInitialStateData(initialData);
    workflow.initState();

    const task: ITask = {
      id: uuidv4(),
      workflowKey: workflow.key,
      state: workflow.getState()!,
      createdAt: new Date(),
    };

    this.tasks.push(task);
    return task;
  }

  public getTasks(): ITask[] {
    return this.tasks;
  }

  public getTask(taskId: string): ITask | undefined {
    return this.tasks.find((t) => t.id === taskId);
  }

  /* ---------- Event Handling ---------- */

  public async handleEvent(
    taskId: string,
    event: IEvent,
  ): Promise<IInvocationLog> {
    const task = this.getTask(taskId);
    if (!task) {
      return {
        success: false,
        message: `Task '${taskId}' not found`,
        task_id: taskId,
        event: event,
        timestamp: new Date().toISOString(),
      };
    }

    const workflow = this.getWorkflow(task.workflowKey);
    if (!workflow) {
      return {
        success: false,
        message: `Workflow '${task.workflowKey}' not found for task`,

        task_id: task.id,
        event: event,

        timestamp: new Date().toISOString(),
      };
    }
    workflow.setState(task.state);

    const result = await workflow.handleEvent(event, this.messenger);
    if (result.success) {
      task.state = result.new_state ?? task.state;
    }
    const invocation_log: IInvocationLog = {
      action_log_data: result,
      task_id: task.id,
      event: event,
      success: !!result.action_key,

      timestamp: new Date().toISOString(),
    };
    this.logs.push(invocation_log);

    return invocation_log;
  }
}
