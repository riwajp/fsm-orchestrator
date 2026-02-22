import { ProcurementOrchestrator } from "./orchestrator";
export const orchestrator = new ProcurementOrchestrator();

// Example task initialization
export const task = orchestrator.initTask("rfq_procurement", {
  fileUrl: "https://example.com/rfq.pdf",
});

/* -------------------- Event Handling Demo -------------------- */

export async function runProcurementDemo() {
  console.log(
    await orchestrator.handleEvent(task.id, {
      key: "rfq_uploaded_event",
      payload: {},
    }),
  );
  console.log(
    await orchestrator.handleEvent(task.id, {
      key: "rfq_processed_event",
      payload: {},
    }),
  );
}

runProcurementDemo();
