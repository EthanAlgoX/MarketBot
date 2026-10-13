// Modified for marketbot on 2026-10-13; see MODIFICATIONS.md.
import type { RealtimeFanout, SecretStore } from "@marketbot/adapter-kit";
import { createSecretStore } from "@marketbot/adapters";
import { resolveEncryptionKey } from "@marketbot/core";

/** Worker composition without starting job hosts or database connections. */
export async function createWorkerSecretStore(
  source: NodeJS.ProcessEnv,
  realtime?: RealtimeFanout,
): Promise<SecretStore> {
  const store = createSecretStore(resolveEncryptionKey(source), source, realtime);
  await store.start();
  return store;
}
