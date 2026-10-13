// Modified for marketbot on 2026-10-13; see MODIFICATIONS.md.
// biome-ignore-all lint/suspicious/noTemplateCurlyInString: Compose and workflow expressions are literal fixture data.
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { parse } from "yaml";

interface ComposeService {
  image?: string;
  build?: unknown;
  command?: unknown;
  env_file?: unknown;
  /** YAML may parse unquoted scalars as null/number/boolean. */
  environment?: Record<string, unknown>;
  volumes?: string[];
  ports?: unknown[];
  user?: string;
  restart?: string;
  network_mode?: string;
  networks?: string[];
}

const repoRoot = path.resolve(import.meta.dirname, "../../..");
const composeFile = path.resolve(repoRoot, "infra/compose/docker-compose.images.yml");
const compose = parse(readFileSync(composeFile, "utf8")) as {
  services: Record<string, ComposeService>;
};
const appServices = ["api", "worker", "web", "supervisor"] as const;
/**
 * The images compose file is the no-checkout happy path. It must stay pull-only and self-contained
 * so operators can drop it next to a .env outside any git worktree. Local Docker computers run via
 * an in-stack supervisor (app image + docker.sock) that stays unpublished on the host.
 */
describe("the images compose file", () => {
  it("requires explicit app and computer registry images alongside local dependencies", () => {
    expect(Object.keys(compose.services).sort()).toEqual([
      "api",
      "computer",
      "data-init",
      "postgres",
      "supervisor",
      "web",
      "worker",
    ]);
    for (const service of appServices) {
      expect(compose.services[service]?.image).toContain(
        "${MARKETBOT_IMAGE:?Set MARKETBOT_IMAGE to your registry image}",
      );
      expect(compose.services[service]?.image).toContain("MARKETBOT_IMAGE_TAG");
    }
    expect(compose.services.computer?.image).toContain(
      "${MARKETBOT_COMPUTER_IMAGE:?Set MARKETBOT_COMPUTER_IMAGE to your registry image}",
    );
    expect(compose.services.computer?.image).toContain("MARKETBOT_COMPUTER_IMAGE_TAG");
    expect(compose.services.postgres?.image).toMatch(
      /^\$\{POSTGRES_IMAGE:-postgres:16@sha256:[0-9a-f]{64}\}$/,
    );
    expect(compose.services["data-init"]?.image).toMatch(/^\$\{BUSYBOX_IMAGE:-busybox:1\}$/);
  });

  it("has no implicit application registry or published image tag", () => {
    const text = readFileSync(composeFile, "utf8");
    expect(text).not.toContain("ghcr.io/");
    expect(text).not.toContain(":-edge");
    expect(text).toContain("MARKETBOT_IMAGE:?");
    expect(text).toContain("MARKETBOT_COMPUTER_IMAGE:?");
  });

  it("passes optional HTTP(S)_PROXY / NO_PROXY into api and worker", () => {
    for (const name of ["api", "worker"] as const) {
      const env = compose.services[name]?.environment ?? {};
      expect(env.HTTP_PROXY).toBe("${HTTP_PROXY:-${http_proxy:-}}");
      expect(env.HTTPS_PROXY).toBe("${HTTPS_PROXY:-${https_proxy:-}}");
      expect(env.NO_PROXY).toBe("${NO_PROXY:-${no_proxy:-}}");
      expect(env.http_proxy).toBe("${http_proxy:-${HTTP_PROXY:-}}");
      expect(env.https_proxy).toBe("${https_proxy:-${HTTPS_PROXY:-}}");
      expect(env.no_proxy).toBe("${no_proxy:-${NO_PROXY:-}}");
    }
  });

  it("does not allocate a default network for offline init services", () => {
    for (const name of ["computer", "data-init"]) {
      expect(compose.services[name]?.network_mode).toBe("none");
      expect(compose.services[name]?.networks).toBeUndefined();
    }
    for (const name of ["postgres", ...appServices]) {
      expect(compose.services[name]?.networks?.length).toBeGreaterThan(0);
    }
  });

  it("never builds from a checkout", () => {
    for (const service of Object.values(compose.services)) {
      expect(service.build).toBeUndefined();
    }
  });

  it("loads secrets from a colocated .env", () => {
    expect(compose.services.api?.env_file).toEqual([".env"]);
    expect(compose.services.worker?.env_file).toEqual([".env"]);
  });

  it("defaults API and worker to Docker computers via the supervisor", () => {
    expect(compose.services.api?.environment?.SANDBOX_PROVIDER).toContain("docker");
    expect(compose.services.worker?.environment?.SANDBOX_PROVIDER).toContain("docker");
    expect(compose.services.api?.environment?.SANDBOX_SUPERVISOR_URL).toBe(
      "http://supervisor:7091",
    );
    expect(compose.services.worker?.environment?.SANDBOX_SUPERVISOR_URL).toBe(
      "http://supervisor:7091",
    );
  });

  it("keeps the Docker socket on the unpublished supervisor only", () => {
    for (const [name, service] of Object.entries(compose.services)) {
      const hasSocket = (service.volumes ?? []).some((volume) => volume.includes("docker.sock"));
      if (name === "supervisor") {
        expect(hasSocket).toBe(true);
        expect(service.ports).toBeUndefined();
        expect(service.user).toBe("root");
        expect(String(service.command)).toContain("sandbox-supervisor");
      } else {
        expect(hasSocket).toBe(false);
      }
    }
  });

  it("publishes the web UI on loopback only", () => {
    expect(compose.services.web?.ports).toEqual(["127.0.0.1:${MARKETBOT_WEB_PORT:-5173}:5173"]);
    expect(compose.services.api?.ports).toEqual(["127.0.0.1:${MARKETBOT_API_PORT:-3100}:3100"]);
    for (const key of ["BETTER_AUTH_URL", "WEB_ORIGIN", "API_URL"]) {
      expect(compose.services.api?.environment?.[key]).toBe(`\${${key}:-http://127.0.0.1:5173}`);
    }
    expect(compose.services.postgres?.ports).toBeUndefined();
    expect(compose.services.supervisor?.ports).toBeUndefined();
  });

  it("passes logging variables to the supervisor without putting them on computer containers", () => {
    expect(compose.services.supervisor?.environment?.AXIOM_TOKEN).toBe("${AXIOM_TOKEN:-}");
    expect(compose.services.supervisor?.environment?.AXIOM_DATASET).toBe("${AXIOM_DATASET:-}");
    expect(compose.services.computer?.environment?.AXIOM_TOKEN).toBeUndefined();
    expect(compose.services.computer?.environment?.LOG_LEVEL).toBeUndefined();
  });
});
