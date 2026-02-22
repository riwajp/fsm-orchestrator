import { Action } from "../../src/action/Action";
import type { IState } from "../../src/types";

/* -------------------- Actions -------------------- */

// 1. Process RFQ file
const processRfqAction = new Action(
  "process_rfq",
  "Process the RFQ file",
  (state: IState) => ({
    can: state.key === "rfq_uploaded",
    description: "RFQ must be uploaded first",
  }),
  (state: IState) => {
    console.log(
      `[Action] Processing RFQ file for task with fileUrl: ${state.data.fileUrl}`,
    );
    return {
      action_key: "process_rfq",
      new_state: { ...state, key: "processing" },
      cost: 10,
      success: true,
      data: { rfq_id: "12345", rfq_requirements: ["1", "2"] },
    };
  },
);

const notifyRoleSelectionAction = new Action(
  "notify_role_selection",
  "Notify human for role selection.",
  (state: IState) => ({
    can: state.key === "processing",
    description: "File must be in processing state",
  }),
  (state: IState, messenger: any) => {
    console.log(
      `[Action] RFQ processing completed for fileUrl: ${state.data.fileUrl}`,
    );

    console.log(
      `[Action] Notifying human to assign roles for fileUrl: ${state.data.fileUrl}`,
    );

    return {
      action_key: "notify_role_selection",
      new_state: {
        ...state,
        key: "awaiting_role_assignment",
      },
      cost: 2, // lower cost than processing
      success: true,
      data: {
        notification_channel: "role_assignment_channel",
      },
    };
  },
);

export { processRfqAction, notifyRoleSelectionAction };
