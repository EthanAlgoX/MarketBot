// Modified for marketbot on 2026-10-13; see MODIFICATIONS.md.
import { waitForModelOAuthCompletion } from "@marketbot/core";
import { rpc } from "./api";

export { cancelModelOAuthAttempt, finishModelOAuthAttempt } from "@marketbot/core";

type CompleteOAuthResult =
  | { status: "pending" }
  | { status: "ready" }
  | { status: "error"; error: string };

export async function waitForModelOAuth(loginId: string, signal?: AbortSignal) {
  return waitForModelOAuthCompletion(
    () => rpc<CompleteOAuthResult>("models/completeOAuth", { loginId }, { signal }),
    { signal },
  );
}
