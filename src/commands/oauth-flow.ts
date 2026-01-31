/*
 * Copyright (C) 2026 MarketBot
 *
 * This file is part of MarketBot.
 *
 * MarketBot is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as
 * published by the Free Software Foundation, either version 3 of the
 * License, or (at your option) any later version.
 *
 * MarketBot is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with MarketBot.  If not, see <https://www.gnu.org/licenses/>.
 */

import type { RuntimeEnv } from "../runtime.js";
import type { WizardPrompter } from "../wizard/prompts.js";

type OAuthPrompt = { message: string; placeholder?: string };

const validateRequiredInput = (value: string) => (value.trim().length > 0 ? undefined : "Required");

export function createVpsAwareOAuthHandlers(params: {
  isRemote: boolean;
  prompter: WizardPrompter;
  runtime: RuntimeEnv;
  spin: ReturnType<WizardPrompter["progress"]>;
  openUrl: (url: string) => Promise<unknown>;
  localBrowserMessage: string;
  manualPromptMessage?: string;
}): {
  onAuth: (event: { url: string }) => Promise<void>;
  onPrompt: (prompt: OAuthPrompt) => Promise<string>;
} {
  const manualPromptMessage =
    params.manualPromptMessage ?? "Paste the redirect URL (or authorization code)";
  let manualCodePromise: Promise<string> | undefined;

  return {
    onAuth: async ({ url }) => {
      if (params.isRemote) {
        params.spin.stop("OAuth URL ready");
        params.runtime.log(`\nOpen this URL in your LOCAL browser:\n\n${url}\n`);
        manualCodePromise = params.prompter
          .text({
            message: manualPromptMessage,
            validate: validateRequiredInput,
          })
          .then((value) => String(value));
        return;
      }

      params.spin.update(params.localBrowserMessage);
      await params.openUrl(url);
      params.runtime.log(`Open: ${url}`);
    },
    onPrompt: async (prompt) => {
      if (manualCodePromise) {
        return manualCodePromise;
      }
      const code = await params.prompter.text({
        message: prompt.message,
        placeholder: prompt.placeholder,
        validate: validateRequiredInput,
      });
      return String(code);
    },
  };
}
