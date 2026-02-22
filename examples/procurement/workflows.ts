import { Workflow } from "../../src/orchestrator";
import { processRfqAction, notifyRoleSelectionAction } from "./actions";

/* -------------------- Workflow -------------------- */

const rfqProcurementWorkflow = new Workflow("rfq_procurement", "rfq_uploaded");

// Define triggers
rfqProcurementWorkflow.addTrigger(
  "rfq_uploaded_event",
  processRfqAction,
  (state, event) => state.key === "rfq_uploaded",
);
rfqProcurementWorkflow.addTrigger(
  "rfq_processed_event",
  notifyRoleSelectionAction,
  (state, event) => state.key === "processing",
);

export { rfqProcurementWorkflow };
