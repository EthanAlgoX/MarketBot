// Modified for marketbot on 2026-10-13; see MODIFICATIONS.md.
import Constants from "expo-constants";
import * as Notifications from "expo-notifications";
import { rpc } from "./api";

export async function registerPushToken() {
  const projectId = Constants.easConfig?.projectId ?? Constants.expoConfig?.extra?.eas?.projectId;
  if (!projectId) return;
  const existing = await Notifications.getPermissionsAsync();
  const granted = existing.granted || (await Notifications.requestPermissionsAsync()).granted;
  if (!granted) return;
  try {
    const token = (await Notifications.getExpoPushTokenAsync({ projectId })).data;
    if (!token) return;
    await rpc("notifications/registerPush", { token });
  } catch {
    // Expo Go cannot mint an ExponentPushToken without an EAS project id.
  }
}

export async function unregisterPushToken() {
  await rpc("notifications/unregisterPush").catch(() => undefined);
}
