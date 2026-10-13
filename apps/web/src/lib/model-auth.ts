// Modified for marketbot on 2026-10-13; see MODIFICATIONS.md.
import { waitForModelOAuthCompletion } from "@marketbot/core";
import { rpc } from "./rpc";

export type { ModelCatalogEntry, ModelCredential, ModelOAuthBegin } from "@marketbot/contracts";
export { cancelModelOAuthAttempt, finishModelOAuthAttempt } from "@marketbot/core";

export async function waitForModelOAuth(loginId: string, signal?: AbortSignal) {
  return waitForModelOAuthCompletion(() => rpc.models.completeOAuth({ loginId }, { signal }), {
    signal,
  });
}
