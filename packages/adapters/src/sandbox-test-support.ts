// Modified for marketbot on 2026-10-13; see MODIFICATIONS.md.
import type { AdapterContext, SandboxProvider } from "@marketbot/adapter-kit";

export async function provisionPrepared(
  provider: SandboxProvider,
  request: { botId: string; homePath: string },
  context: AdapterContext,
) {
  const computer = await provider.provision(request, context);
  await provider.prepare(computer, context);
  return computer;
}
