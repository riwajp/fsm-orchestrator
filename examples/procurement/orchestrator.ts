import { Orchestrator } from "../../src/orchestrator/Orchestrator";
import { rfqProcurementWorkflow } from "./workflows";

export class ProcurementOrchestrator extends Orchestrator {
  constructor() {
    // Initialize with all workflows
    super("ProcurementAI", [rfqProcurementWorkflow]);
  }
}
