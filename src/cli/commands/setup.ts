import path from "node:path";

import type { MarketBotConfig } from "../../config/types.js";
import { ensureConfig, loadConfig } from "../../config/io.js";
import { resolveConfigPath, resolveWorkspaceRoot } from "../../config/paths.js";
import { ensureWorkspace } from "../../agents/workspace.js";
import { resolveDefaultAgentId } from "../../agents/agentScope.js";

export async function setupCommand(cwd: string = process.cwd()): Promise<void> {
  const configPath = resolveConfigPath(cwd);
  const workspaceRoot = resolveWorkspaceRoot(configPath);
  const defaultAgentId = "main";
  const defaultWorkspace = path.join(workspaceRoot, defaultAgentId);

  const defaultConfig: MarketBotConfig = {
    agents: {
      defaults: {
        workspace: defaultWorkspace,
        ensureBootstrap: true,
      },
      list: [
        {
          id: defaultAgentId,
          name: "MarketBot",
          default: true,
        },
      ],
    },
    llm: {
      provider: "mock",
    },
  };

  const writtenPath = await ensureConfig(defaultConfig, cwd);
  const config = await loadConfig(cwd);
  const resolvedAgentId = resolveDefaultAgentId(config);
  const workspace = await ensureWorkspace(config, resolvedAgentId, cwd);

  console.log("MarketBot setup complete.");
  console.log(`Config: ${path.relative(cwd, writtenPath)}`);
  console.log(`Workspace: ${path.relative(cwd, workspace.dir)}`);
}
