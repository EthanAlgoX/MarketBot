// Modified for marketbot on 2026-10-13; see MODIFICATIONS.md.
import * as SecureStore from "expo-secure-store";

const LAST_BOT_KEY = "marketbot.last_bot_id";

export async function saveLastBotId(botId: string) {
  if (!botId.trim()) return;
  await SecureStore.setItemAsync(LAST_BOT_KEY, botId);
}

export async function loadLastBotId() {
  try {
    return (await SecureStore.getItemAsync(LAST_BOT_KEY)) ?? "";
  } catch {
    return "";
  }
}
