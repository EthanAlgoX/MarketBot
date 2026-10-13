// Modified for marketbot on 2026-10-13; see MODIFICATIONS.md.
import { createComputerUpdates } from "@marketbot/core";
import { rpc } from "./rpc";
export const computerUpdates = createComputerUpdates({
  list: () => rpc.computer.updates(),
  start: (botId, action) => rpc.computer[action]({ botId }),
  releaseInterrupted: (id) => rpc.computer.releaseInterrupted({ id, workersStopped: true }),
  dismiss: (id) => rpc.computer.dismissUpdate({ id }),
});
