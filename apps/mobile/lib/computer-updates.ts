// Modified for marketbot on 2026-10-13; see MODIFICATIONS.md.
import type { ComputerUpdate } from "@marketbot/contracts";
import { createComputerUpdates } from "@marketbot/core";
import { rpc } from "./api";
export const computerUpdates = createComputerUpdates({
  list: () => rpc<ComputerUpdate[]>("computer/updates"),
  start: (botId, action) => rpc<ComputerUpdate>(`computer/${action}`, { botId }),
  releaseInterrupted: (id) => rpc("computer/releaseInterrupted", { id, workersStopped: true }),
  dismiss: (id) => rpc("computer/dismissUpdate", { id }),
});
