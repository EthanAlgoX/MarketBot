// Modified for marketbot on 2026-10-13; see MODIFICATIONS.md.
import * as SecureStore from "expo-secure-store";

export const DEVICE_VOICE_KEY = "marketbot.device-voice";

export async function loadDeviceVoiceEnabled(): Promise<boolean> {
  return (await SecureStore.getItemAsync(DEVICE_VOICE_KEY)) === "1";
}

export async function saveDeviceVoiceEnabled(on: boolean): Promise<void> {
  if (on) await SecureStore.setItemAsync(DEVICE_VOICE_KEY, "1");
  else await SecureStore.deleteItemAsync(DEVICE_VOICE_KEY);
}
