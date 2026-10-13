import type { ConfigContext } from "expo/config";
import { afterEach, describe, expect, it, vi } from "vitest";
import configureApp from "../app.config";

function context(): ConfigContext {
  return {
    config: {
      name: "金融助手",
      slug: "marketbot",
      extra: { router: {}, eas: { projectId: "discarded-input" } },
    },
    projectRoot: "/test/project",
    staticConfigPath: null,
    packageJsonPath: null,
  };
}

afterEach(() => vi.unstubAllEnvs());

describe("application-owned Expo deployment", () => {
  it("has no implicit push or update project", () => {
    vi.stubEnv("EAS_BUILD_PROFILE", "preview");
    vi.stubEnv("EXPO_PUBLIC_EAS_PROJECT_ID", "");
    const config = configureApp(context());
    expect(config.extra?.eas).toBeUndefined();
    expect(config.extra?.router).toEqual({});
    expect(config.updates).toEqual({ enabled: false });
  });

  it("accepts an explicitly supplied project without enabling OTA", () => {
    vi.stubEnv("EAS_BUILD_PROFILE", "preview");
    const projectId = "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee";
    vi.stubEnv("EXPO_PUBLIC_EAS_PROJECT_ID", projectId);
    const config = configureApp(context());
    expect(config.extra?.eas).toEqual({ projectId });
    expect(config.updates).toEqual({ enabled: false });
  });

  it("rejects malformed project IDs and insecure production endpoints", () => {
    vi.stubEnv("EAS_BUILD_PROFILE", "preview");
    vi.stubEnv("EXPO_PUBLIC_EAS_PROJECT_ID", "not-a-project");
    expect(() => configureApp(context())).toThrow("your own EAS project UUID");
    vi.stubEnv("EXPO_PUBLIC_EAS_PROJECT_ID", "");
    vi.stubEnv("EAS_BUILD_PROFILE", "production");
    vi.stubEnv("EXPO_PUBLIC_API_URL", "http://example.test");
    expect(() => configureApp(context())).toThrow("HTTPS");
  });
});
