import { Orchestrator } from "../../src/orchestrator/Orchestrator";
import { ITask } from "../../src/types";
import { IInvocationLog } from "../../src/types/logs";
import { rfqProcurementWorkflow } from "./workflows";

export class ProcurementOrchestrator extends Orchestrator {
  constructor() {
    // Initialize with all workflows
    super("ProcurementAI", [rfqProcurementWorkflow]);
  }

  protected persistTaskState(task: ITask): void {
    // Implement persistence logic here
  }

  protected persistInvocationLog(log: IInvocationLog): void {
    // Implement persistence logic here
  }
}
