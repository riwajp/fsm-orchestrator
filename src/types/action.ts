import type { IActionLogData } from "./logs";

/**
 * Result type for canBeInvoked method.
 */
export type TCanBeInvoked = { can: boolean; description: string };

export type IEmitEvent = {
  key: string;
  buildPayload: (log: IActionLogData) => any;
};
