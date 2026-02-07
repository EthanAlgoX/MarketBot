import type { MarketBotPluginApi } from "marketbot/plugin-sdk";
import { emptyPluginConfigSchema } from "marketbot/plugin-sdk";

import { qqbotPlugin } from "./src/channel.js";
import { setQQBotRuntime } from "./src/runtime.js";

const plugin = {
  id: "qqbot",
  name: "QQ Bot",
  description: "MarketBot QQ Bot channel plugin (Gateway WS)",
  configSchema: emptyPluginConfigSchema(),
  register(api: MarketBotPluginApi) {
    setQQBotRuntime(api.runtime);
    api.registerChannel({ plugin: qqbotPlugin });
  },
};

export default plugin;

