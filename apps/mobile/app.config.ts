// Modified for marketbot on 2026-10-13; see MODIFICATIONS.md.
import type { ConfigContext, ExpoConfig } from "expo/config";

export default ({ config }: ConfigContext): ExpoConfig => {
  const projectId = process.env.EXPO_PUBLIC_EAS_PROJECT_ID?.trim();
  const extra = { ...config.extra };
  delete extra.eas;
  if (projectId && !/^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/i.test(projectId)) {
    throw new Error("EXPO_PUBLIC_EAS_PROJECT_ID must be your own EAS project UUID.");
  }
  if (process.env.EAS_BUILD_PROFILE === "production") {
    const apiUrl = process.env.EXPO_PUBLIC_API_URL;
    if (!apiUrl) {
      throw new Error(
        "EXPO_PUBLIC_API_URL must be set in the EAS production environment before building for the App Store.",
      );
    }

    let parsed: URL;
    try {
      parsed = new URL(apiUrl);
    } catch {
      throw new Error("EXPO_PUBLIC_API_URL must be a valid URL.");
    }
    if (parsed.protocol !== "https:") {
      throw new Error("EXPO_PUBLIC_API_URL must use HTTPS for production builds.");
    }
  }

  return {
    ...config,
    extra: {
      ...extra,
      ...(projectId ? { eas: { projectId } } : {}),
    },
    // OTA publishing needs a separately configured project-owned release channel.
    updates: { enabled: false },
  } as ExpoConfig;
};
