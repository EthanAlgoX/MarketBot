// Modified for marketbot on 2026-10-13; see MODIFICATIONS.md.
import { describe, expect, it } from "vitest";
import {
  DEFAULT_UPDATE_BRANCH,
  decideUpdateAvailability,
  detectRestartSupervisor,
  isOfficialRepoUrl,
  normalizeRepoUrl,
  normalizeUpdateBranch,
  OFFICIAL_REPO_URL,
  parseGitStatusPorcelain,
  RESTART_SUPERVISOR_ENV,
  repoIdentity,
  restartSupervisorAdvice,
  shortCommit,
  updateSteps,
} from "./self-update.js";

describe("normalizeRepoUrl", () => {
  it("requires an explicit repository and accepts valid https remotes", () => {
    expect(OFFICIAL_REPO_URL).toBe("");
    expect(normalizeRepoUrl(OFFICIAL_REPO_URL)).toHaveProperty("error");
    expect(normalizeRepoUrl("  https://github.com/me/marketbot.git/  ")).toEqual({
      url: "https://github.com/me/marketbot.git",
    });
    expect(normalizeRepoUrl("https://git.example.com:8443/team/marketbot.git")).toEqual({
      url: "https://git.example.com:8443/team/marketbot.git",
    });
  });

  it("accepts ssh remotes in both spellings", () => {
    expect(normalizeRepoUrl("git@github.com:me/marketbot.git")).toEqual({
      url: "git@github.com:me/marketbot.git",
    });
    expect(normalizeRepoUrl("ssh://git@github.com/me/marketbot.git")).toEqual({
      url: "ssh://git@github.com/me/marketbot.git",
    });
  });

  it("refuses transports and shapes that are not a git remote", () => {
    for (const input of [
      "",
      "   ",
      "http://github.com/me/marketbot",
      "git://github.com/me/marketbot",
      "file:///etc/passwd",
      "/srv/marketbot",
      "https://github.com",
      "https://github.com/onlyone",
      "https://github.com/me/../../etc",
      "https://user:secret@github.com/me/marketbot",
      "https://token@github.com/me/marketbot",
      "ssh://bad%0auser@github.com/me/marketbot",
      "https://github.com/me/marketbot?x=1",
      "https://github.com/me/marketbot#frag",
      "https://github.com/me/invalid name",
      "--upload-pack=touch /tmp/pwned",
      "-o ProxyCommand=id",
      `https://github.com/me/marketbot${"x".repeat(400)}`,
    ]) {
      expect(normalizeRepoUrl(input), input).toHaveProperty("error");
    }
  });

  it("rejects an embedded newline that could smuggle a second argument", () => {
    expect(normalizeRepoUrl("https://github.com/me/marketbot\n--exec=id")).toHaveProperty("error");
  });
});

describe("repoIdentity", () => {
  it("treats every spelling of the same remote as one repository", () => {
    const identity = "github.com/example/marketbot";
    expect(repoIdentity("https://github.com/example/marketbot")).toBe(identity);
    expect(repoIdentity("https://github.com/example/marketbot.git")).toBe(identity);
    expect(repoIdentity("git@github.com:example/marketbot.git")).toBe(identity);
    expect(repoIdentity("ssh://git@github.com/Example/MarketBot")).toBe(identity);
    expect(repoIdentity("not a url")).toBeNull();
  });

  it("has no official channel until a trusted repository is explicitly configured", () => {
    const configured = "https://git.example/team/financial-assistant";
    expect(isOfficialRepoUrl(configured)).toBe(false);
    expect(isOfficialRepoUrl("")).toBe(false);
    expect(isOfficialRepoUrl("git@git.example:team/financial-assistant.git", configured)).toBe(
      true,
    );
    expect(isOfficialRepoUrl("https://git.example/attacker/financial-assistant", configured)).toBe(
      false,
    );
    expect(isOfficialRepoUrl("https://git.invalid/team/financial-assistant", configured)).toBe(
      false,
    );
    expect(isOfficialRepoUrl(configured, "--upload-pack=id")).toBe(false);
    expect(isOfficialRepoUrl("https://git.example:8443/team/financial-assistant", configured)).toBe(
      false,
    );
  });
});

describe("normalizeUpdateBranch", () => {
  it("accepts ordinary branch names", () => {
    expect(normalizeUpdateBranch("  main  ")).toEqual({ branch: "main" });
    expect(normalizeUpdateBranch("release/1.2")).toEqual({ branch: "release/1.2" });
  });

  it("refuses names git would reject or that could be read as a flag", () => {
    for (const input of [
      "",
      "with space",
      "-f",
      "a..b",
      "tip@{1}",
      "bad~1",
      "x:y",
      ".hidden",
      "feature/.hidden",
      "feature//nested",
      "trailing.",
      "@",
      "/lead",
      "t/",
      "x.lock",
    ]) {
      expect(normalizeUpdateBranch(input), input).toHaveProperty("error");
    }
  });
});

describe("parseGitStatusPorcelain", () => {
  it("reports a clean tree for empty output", () => {
    expect(parseGitStatusPorcelain("")).toEqual({ clean: true, changed: [] });
    expect(parseGitStatusPorcelain("\n  \n")).toEqual({ clean: true, changed: [] });
  });

  it("lists tracked modifications", () => {
    expect(parseGitStatusPorcelain(" M apps/api/src/app.ts\nA  packages/core/src/x.ts\n")).toEqual({
      clean: false,
      changed: ["apps/api/src/app.ts", "packages/core/src/x.ts"],
    });
  });
});

describe("updateSteps", () => {
  it("orders the work so migrations land immediately before the restart", () => {
    const steps = updateSteps({
      remoteUrl: OFFICIAL_REPO_URL,
      branch: DEFAULT_UPDATE_BRANCH,
      targetCommit: "2".repeat(40),
    });
    expect(steps.map((step) => step.id)).toEqual([
      "fetch",
      "merge",
      "install",
      "generate",
      "build",
      "migrate",
    ]);
  });

  it("passes every value as its own argument so nothing reaches a shell", () => {
    const steps = updateSteps({
      remoteUrl: "git@github.com:me/marketbot.git",
      branch: "release/1.2",
      targetCommit: "2".repeat(40),
      repointRemote: true,
    });
    expect(steps[0]).toEqual({
      id: "remote",
      label: "Point the checkout at the chosen repository",
      command: "git",
      args: ["remote", "set-url", "origin", "git@github.com:me/marketbot.git"],
    });
    expect(steps.find((step) => step.id === "merge")?.args).toEqual([
      "merge",
      "--ff-only",
      "2".repeat(40),
    ]);
  });

  it("never rewrites history, so local commits fail the update instead of vanishing", () => {
    const args = updateSteps({
      remoteUrl: OFFICIAL_REPO_URL,
      branch: "main",
      targetCommit: "2".repeat(40),
    }).flatMap((step) => step.args);
    expect(args).not.toContain("--hard");
    expect(args).not.toContain("--force");
    expect(args).toContain("--ff-only");
  });
});

describe("detectRestartSupervisor", () => {
  it("takes the operator's declaration first", () => {
    expect(detectRestartSupervisor({ [RESTART_SUPERVISOR_ENV]: "docker" })).toEqual({
      kind: "declared",
      label: "docker",
    });
  });

  it("recognises systemd and pm2 from the variables they set", () => {
    expect(detectRestartSupervisor({ INVOCATION_ID: "abc" })).toEqual({
      kind: "systemd",
      label: "systemd",
    });
    expect(detectRestartSupervisor({ pm_id: "0" })).toEqual({ kind: "pm2", label: "pm2" });
  });

  it("reports none for a bare checkout, and says how to fix it", () => {
    expect(detectRestartSupervisor({})).toEqual({ kind: "none", label: null });
    expect(detectRestartSupervisor({ [RESTART_SUPERVISOR_ENV]: "  " })).toEqual({
      kind: "none",
      label: null,
    });
    expect(restartSupervisorAdvice(detectRestartSupervisor({}))).toContain(RESTART_SUPERVISOR_ENV);
    expect(restartSupervisorAdvice({ kind: "systemd", label: "systemd" })).toContain("systemd");
  });
});

describe("decideUpdateAvailability", () => {
  it("refuses when the checkout cannot be updated at all", () => {
    expect(decideUpdateAvailability({ checkoutReason: "Not a git checkout." })).toEqual({
      status: "unavailable",
      reason: "Not a git checkout.",
    });
    expect(decideUpdateAvailability({ commit: "abc" })).toEqual({
      status: "unavailable",
      reason: "Could not read the current commit.",
    });
  });

  it("refuses a dirty tree before comparing commits", () => {
    expect(
      decideUpdateAvailability({
        commit: "aaa",
        targetCommit: "bbb",
        status: { clean: false, changed: ["apps/api/src/app.ts"] },
      }),
    ).toEqual({ status: "dirty", changed: ["apps/api/src/app.ts"] });
  });

  it("separates up to date from an available update", () => {
    const clean = { clean: true, changed: [] };
    expect(decideUpdateAvailability({ commit: "aaa", targetCommit: "aaa", status: clean })).toEqual(
      { status: "up-to-date", commit: "aaa" },
    );
    expect(
      decideUpdateAvailability({
        commit: "aaa",
        targetCommit: "bbb",
        behindBy: 4,
        status: clean,
      }),
    ).toEqual({ status: "available", commit: "aaa", targetCommit: "bbb", behindBy: 4 });
  });
});

describe("shortCommit", () => {
  it("shortens a sha and names the unknown case", () => {
    expect(shortCommit("3c6e2091a2b3c4")).toBe("3c6e209");
    expect(shortCommit(null)).toBe("unknown");
    expect(shortCommit("")).toBe("unknown");
  });
});
