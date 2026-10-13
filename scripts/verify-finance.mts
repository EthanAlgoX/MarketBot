import assert from "node:assert/strict";
import type { ChildProcess } from "node:child_process";
import { spawn, spawnSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import {
  closeSync,
  existsSync,
  mkdirSync,
  openSync,
  readFileSync,
  realpathSync,
  writeFileSync,
} from "node:fs";
import { createServer } from "node:net";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createDb, createPool } from "../packages/db/src/client.js";
import { ingestFinanceEvents } from "../packages/db/src/finance-events.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const engine = path.join(root, "services/financial-engine");
const runtime = path.join(root, ".local/runtime/bin");
const financialPython =
  // biome-ignore lint/suspicious/noUndeclaredEnvVars: this standalone verifier is never a cached Turbo task.
  process.env.FINANCE_PYTHON ??
  path.join(
    engine,
    existsSync(path.join(engine, ".minimal-venv/bin/python"))
      ? ".minimal-venv/bin/python"
      : ".venv/bin/python",
  );
const cleanupIndex = process.argv.indexOf("--cleanup");
if (cleanupIndex >= 0) {
  const target = process.argv[cleanupIndex + 1];
  assert(target, "--cleanup requires the private verification artifact directory.");
  const folder = realpathSync(path.resolve(target));
  assert.equal(path.dirname(folder), realpathSync(path.join(root, ".local/verify")));
  const owner = JSON.parse(readFileSync(path.join(folder, "owner.json"), "utf8"));
  assert.equal(owner.root, root);
  assert.match(owner.databaseName, /^finance_verify_[0-9a-f]{16}$/);
  const records = JSON.parse(readFileSync(path.join(folder, "processes.json"), "utf8")) as Array<{
    name: string;
    pid: number;
    identity: string;
  }>;
  for (const record of records.reverse()) {
    const identity = spawnSync("ps", ["-p", String(record.pid), "-o", "lstart="], {
      encoding: "utf8",
    }).stdout.trim();
    if (!identity) continue;
    assert.equal(identity, record.identity, `Refusing to stop a reused ${record.name} PID.`);
    const group = spawnSync("ps", ["-p", String(record.pid), "-o", "pgid="], {
      encoding: "utf8",
    }).stdout.trim();
    assert.equal(Number(group), record.pid, "Refusing to signal an unexpected process group.");
    try {
      process.kill(-record.pid, "SIGTERM");
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ESRCH") throw error;
    }
  }
  await new Promise<void>((resolve) => setTimeout(resolve, 1_000));
  const cleanupPool = createPool(owner.adminUrl);
  try {
    await cleanupPool.query(`DROP DATABASE IF EXISTS "${owner.databaseName}" WITH (FORCE)`);
  } finally {
    await cleanupPool.end();
  }
  process.stdout.write(
    "Stopped project-owned verification services and dropped their disposable database.\n",
  );
  process.exit(0);
}
const keep = process.argv.includes("--keep");
const withWeb = process.argv.includes("--web");
const runId = randomBytes(8).toString("hex");
const directory = path.join(root, ".local/verify", runId);
const databaseName = `finance_verify_${runId}`;
const adminUrl = process.env.DATABASE_URL;
assert(
  adminUrl,
  "Run through scripts/finance-dev.sh run to use the isolated development PostgreSQL.",
);
const testDatabaseUrl = new URL(adminUrl);
testDatabaseUrl.pathname = `/${databaseName}`;
const admin = createPool(adminUrl);
const children = new Map<string, ChildProcess>();
const checks: string[] = [];
mkdirSync(directory, { recursive: true, mode: 0o700 });

function privateJson(filename: string, value: unknown) {
  writeFileSync(path.join(directory, filename), JSON.stringify(value, null, 2), { mode: 0o600 });
}

async function freePort() {
  const server = createServer();
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  const address = server.address();
  assert(address && typeof address !== "string");
  const port = address.port;
  await new Promise<void>((resolve, reject) =>
    server.close((error) => (error ? reject(error) : resolve())),
  );
  return port;
}

const apiPort = await freePort();
const financePort = await freePort();
const webPort = await freePort();
const apiUrl = `http://127.0.0.1:${apiPort}`;
const financeUrl = `http://127.0.0.1:${financePort}`;
const webUrl = `http://127.0.0.1:${webPort}`;
const issuer = `verify-${runId}`;
const bridgeToken = randomBytes(32).toString("hex");
const env: NodeJS.ProcessEnv = {
  ...process.env,
  NODE_ENV: "test",
  DATABASE_URL: testDatabaseUrl.href,
  REALTIME_DATABASE_URL: testDatabaseUrl.href,
  DATA_DIR: path.join(directory, "assistant-data"),
  DATABASE_PATH: path.join(directory, "financial/control.db"),
  LOG_DIR: path.join(directory, "financial/logs"),
  ENV_FILE: path.join(directory, "verify.env"),
  BETTER_AUTH_SECRET: randomBytes(32).toString("hex"),
  ENCRYPTION_KEY: randomBytes(32).toString("hex"),
  SCREEN_PROXY_SECRET: randomBytes(32).toString("hex"),
  API_HOST: "127.0.0.1",
  API_PORT: String(apiPort),
  API_URL: apiUrl,
  WEB_PORT: String(webPort),
  WEB_ORIGIN: webUrl,
  BETTER_AUTH_URL: webUrl,
  API_PROXY_TARGET: apiUrl,
  FINANCIAL_BRIDGE_URL: financeUrl,
  FINANCIAL_BRIDGE_TOKEN: bridgeToken,
  FINANCIAL_BRIDGE_ISSUER: issuer,
  SANDBOX_PROVIDER: "none",
  CLOUD_AGENT_PROVIDER: "none",
  AGENT_RUNTIME: "scripted",
  WAKEUP_DRIVER: "graphile",
  SIGNUPS_ENABLED: "true",
  SIGNUP_ALLOWLIST: "",
  EMAIL_EMULATOR: "false",
  SCHEDULE_ENABLED: "false",
  AGENT_EVENT_MONITOR_ENABLED: "false",
  STOCK_INDEX_REMOTE_UPDATE_ENABLED: "false",
  PYTHONNOUSERSITE: "1",
  ASSISTANT_RESEARCH_ENABLED: "false",
  FINANCIAL_SIMULATION_ENABLED: "false",
  LOG_LEVEL: "info",
  PATH: runtime + path.delimiter + (process.env.PATH ?? ""),
};
for (const name of [
  "OIDC_ISSUER",
  "OIDC_CLIENT_ID",
  "OIDC_CLIENT_SECRET",
  "SMTP_URL",
  "EMAIL_FROM",
  "AXIOM_TOKEN",
]) {
  delete env[name];
}
mkdirSync(path.dirname(env.DATABASE_PATH!), { recursive: true, mode: 0o700 });
mkdirSync(env.LOG_DIR!, { recursive: true, mode: 0o700 });
writeFileSync(
  env.ENV_FILE!,
  "# Isolated financial verification; runtime values supplied by the verifier.\n",
  { mode: 0o600 },
);
privateJson("owner.json", { root, databaseName, adminUrl, env });

function check(label: string) {
  checks.push(label);
  process.stdout.write(`PASS ${label}\n`);
}

function command(name: string, args: string[], cwd = root, capture = false) {
  const result = spawnSync(args[0]!, args.slice(1), { cwd, env, encoding: "utf8" });
  writeFileSync(
    path.join(directory, `${name}.log`),
    (result.stdout ?? "") + (result.stderr ?? ""),
    { mode: 0o600 },
  );
  assert.equal(result.status, 0, `${name} failed; inspect the private verification log.`);
  return capture ? JSON.parse(result.stdout.trim().split("\n").at(-1)!) : undefined;
}

function start(name: string, args: string[], cwd = root) {
  const descriptor = openSync(path.join(directory, `${name}.log`), "a", 0o600);
  const child = spawn(args[0]!, args.slice(1), {
    cwd,
    env,
    stdio: ["ignore", descriptor, descriptor],
    detached: true,
  });
  closeSync(descriptor);
  child.unref();
  children.set(name, child);
  privateJson(
    "processes.json",
    [...children].map(([name, process]) => ({
      name,
      pid: process.pid,
      identity: spawnSync("ps", ["-p", String(process.pid), "-o", "lstart="], {
        encoding: "utf8",
      }).stdout.trim(),
    })),
  );
}

async function stop(name: string) {
  const child = children.get(name);
  if (child?.pid && child.exitCode === null) {
    try {
      process.kill(-child.pid, "SIGTERM");
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ESRCH") throw error;
    }
    for (let i = 0; i < 50 && child.exitCode === null; i++) await delay(100);
  }
  children.delete(name);
}

function delay(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms));
}

async function health(url: string) {
  for (let i = 0; i < 120; i++) {
    const response = await fetch(url).catch(() => undefined);
    if (response?.ok) return;
    await delay(250);
  }
  throw new Error("Verification service did not become healthy; inspect its private log.");
}

type Account = { id: string; email: string; password: string; cookie: string };
async function signup(label: string): Promise<Account> {
  const email = `${label}-${runId}@example.test`;
  const password = randomBytes(24).toString("hex");
  const response = await fetch(`${apiUrl}/api/auth/sign-up/email`, {
    method: "POST",
    headers: { "content-type": "application/json", origin: webUrl },
    body: JSON.stringify({ email, password, name: `Verification ${label}` }),
  });
  assert.equal(response.status, 200, "Isolated signup failed.");
  const body = (await response.json()) as { user: { id: string } };
  const cookie = response.headers
    .getSetCookie()
    .map((value) => value.split(";")[0])
    .join("; ");
  assert(cookie, "Signup did not issue a session cookie.");
  return { id: body.user.id, email, password, cookie };
}

async function rpc(name: string, input: unknown = {}, account?: Account) {
  const procedure = name.includes("/") ? name : `finance/${name}`;
  const response = await fetch(`${apiUrl}/rpc/${procedure}`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      origin: webUrl,
      ...(account ? { cookie: account.cookie } : {}),
    },
    body: JSON.stringify({ json: input }),
  });
  const body = (await response.json()) as { json?: unknown };
  return { status: response.status, data: body.json as any };
}

let financialDb: ReturnType<typeof createDb> | undefined;
let passed = false;
try {
  await admin.query(`CREATE DATABASE "${databaseName}"`);
  command("migrations", [path.join(runtime, "pnpm"), "db:migrate"]);
  financialDb = createDb(testDatabaseUrl.href);
  start(
    "finance",
    [
      financialPython,
      "-m",
      "uvicorn",
      "api.internal.assistant_app:app",
      "--host",
      "127.0.0.1",
      "--port",
      String(financePort),
      "--workers",
      "1",
    ],
    engine,
  );
  start("api", [path.join(runtime, "pnpm"), "--filter", "@marketbot/api", "start"]);
  await Promise.all([health(`${financeUrl}/health`), health(`${apiUrl}/health`)]);
  check("private financial bridge and assistant API started against isolated databases");
  assert.equal((await rpc("overview")).status, 401);
  assert.equal((await rpc("notifications")).status, 401);
  check("logged-out financial requests rejected");
  const alice = await signup("alice");
  const bob = await signup("bob");
  privateJson("access.json", { apiUrl, financeUrl, webUrl, alice, bob });
  assert.equal((await rpc("overview", {}, alice)).data.availability, "unbound");
  check("logged-in unbound user receives an explicit binding state");
  const python = financialPython;
  const binding = command(
    "bind-alice",
    [python, "-m", "scripts.assistant_bridge", "bind", "--issuer", issuer, "--subject", alice.id],
    engine,
    true,
  );
  const connected = await rpc("connect", {}, alice);
  assert.equal(connected.status, 200);
  assert.equal(connected.data.availability, "ready");
  assert.equal((await rpc("connect", {}, alice)).data.availability, "ready");
  const repeatBinding = command(
    "repeat-owner-binding",
    [python, "-m", "scripts.assistant_bridge", "bind", "--issuer", issuer, "--subject", alice.id],
    engine,
    true,
  );
  assert.equal(repeatBinding.workspaceId, binding.workspaceId);
  assert.equal((await rpc("connect", {}, bob)).status, 403);
  assert.equal((await rpc("connect", { userId: bob.id }, alice)).status, 400);
  command(
    "bind-bob",
    [python, "-m", "scripts.assistant_bridge", "bind", "--issuer", issuer, "--subject", bob.id],
    engine,
  );
  check("owner self-binding is stable; non-owner self-binding and identity selectors are rejected");
  const overview = await rpc("overview", {}, alice);
  assert.equal(overview.status, 200);
  assert.equal(overview.data.availability, "ready");
  assert.equal(overview.data.data.capabilities.liveTrading, false);
  assert.equal(overview.data.data.capabilities.readOnly, false);
  assert.deepEqual(overview.data.data.portfolio.accounts, []);
  check("operator CLI binding enables a real persisted SQLite overview");
  const research = await rpc("researchOverview", {}, alice);
  assert.equal(research.status, 200);
  assert.equal(research.data.capabilities.enabled, false);
  assert.equal(research.data.capabilities.reason, "research_disabled");
  assert.equal(research.data.capabilities.sourceCallUnit, "provider_operation");
  assert.equal(research.data.usage.timezone, "UTC");
  assert.equal(research.data.usage.modelCalls, 0);
  assert.equal(research.data.usage.cost, null);
  assert.deepEqual(research.data.requests, []);
  assert.equal((await rpc("researchOverview")).status, 401);
  assert.equal(
    (
      await rpc(
        "researchCommand",
        {
          commandType: "research.create",
          idempotencyKey: "disabled-research-0001",
          market: "crypto",
          symbol: "BTCUSDT",
          reportType: "detailed",
        },
        alice,
      )
    ).status,
    503,
  );
  assert.equal(
    (
      await rpc(
        "researchCommand",
        {
          commandType: "research.create",
          idempotencyKey: "disabled-research-0002",
          market: "crypto",
          symbol: "BTCUSDT",
          workspaceId: binding.workspaceId,
        },
        alice,
      )
    ).status,
    400,
  );
  assert.equal((await rpc("observations")).status, 401);
  assert.deepEqual((await rpc("observations", {}, alice)).data, []);
  assert.deepEqual((await rpc("observations", {}, bob)).data, []);
  assert.equal(
    (
      await rpc(
        "saveObservation",
        {
          requestId: "missing-real-research-request",
          idempotencyKey: "observation-missing-001",
          note: "Synthetic boundary verification",
          validUntil: null,
        },
        alice,
      )
    ).status,
    404,
  );
  assert.equal(
    (
      await rpc(
        "saveObservation",
        {
          requestId: "missing-real-research-request",
          idempotencyKey: "observation-cross-001",
          note: "Synthetic boundary verification",
          validUntil: null,
          userId: alice.id,
        },
        bob,
      )
    ).status,
    400,
  );
  assert.equal(await financialDb.prisma.researchObservation.count(), 0);
  check("observations require login and a real completed owned research reference");
  const catalog = await rpc("simulationCatalog", {}, alice);
  assert.equal(catalog.status, 200);
  assert.equal(catalog.data.enabled, false);
  assert(catalog.data.rules.every((rule: { available: boolean }) => !rule.available));
  check("disabled research and simulation gates return honest capabilities and call no model");
  assert.equal(
    (await rpc("overview", { userId: bob.id, workspaceId: binding.workspaceId }, alice)).status,
    400,
  );
  const badAuth = await fetch(`${financeUrl}/internal/assistant/v1/overview`, {
    headers: {
      authorization: "Bearer incorrect",
      "x-assistant-issuer": issuer,
      "x-assistant-subject": alice.id,
    },
  });
  assert.equal(badAuth.status, 401);
  check("client identity selectors and incorrect service credentials rejected");
  const event = command(
    "emit-event",
    [
      python,
      "-m",
      "scripts.assistant_bridge",
      "emit-test",
      "--issuer",
      issuer,
      "--subject",
      alice.id,
      "--message",
      "Offline integration verification",
    ],
    engine,
    true,
  );
  start("worker", [path.join(runtime, "pnpm"), "--filter", "@marketbot/worker", "start"]);
  let notification: { id: string; readAt: string | null } | undefined;
  for (let i = 0; i < 120; i++) {
    const list = await rpc("notifications", {}, alice);
    notification = list.data.items[0];
    if (notification) break;
    await delay(500);
  }
  assert(notification, "Worker did not persist the test event notification.");
  const inbox = await financialDb.prisma.financeEventInbox.findMany({
    where: { userId: alice.id },
  });
  assert.equal(inbox.length, 1);
  assert.equal(inbox[0]?.eventId, event.id);
  const cursor = await financialDb.prisma.financeEventCursor.findUnique({
    where: { userId: alice.id },
  });
  assert.equal(cursor?.sequence, BigInt(event.sequence));
  check("committed financial event consumed by real worker into inbox, notification and cursor");
  const pageResponse = await fetch(`${financeUrl}/internal/assistant/v1/events?after=0`, {
    headers: {
      authorization: `Bearer ${bridgeToken}`,
      "x-assistant-issuer": issuer,
      "x-assistant-subject": alice.id,
    },
  });
  const page = await pageResponse.json();
  assert.equal(await ingestFinanceEvents(financialDb.prisma, alice.id, issuer, page), 0);
  assert.equal(await ingestFinanceEvents(financialDb.prisma, alice.id, issuer, page), 0);
  assert.equal(
    await financialDb.prisma.financeNotification.count({ where: { userId: alice.id } }),
    1,
  );
  check("replaying the committed event preserves a single notification");
  assert.deepEqual((await rpc("notifications", {}, bob)).data.items, []);
  assert.equal((await rpc("markRead", { id: notification.id }, bob)).status, 404);
  assert.equal((await rpc("markRead", { id: notification.id }, alice)).status, 200);
  assert((await rpc("notifications", {}, alice)).data.items[0].readAt);
  check("cross-user notification access rejected and read feedback persisted");
  const watchlistAdd = {
    commandType: "watchlist.add",
    idempotencyKey: randomBytes(16).toString("hex"),
    expectedRevision: 0,
    market: "crypto",
    symbol: "BTCUSDT",
  };
  const added = await rpc("watchlistCommand", watchlistAdd, alice);
  assert.equal(added.status, 200);
  assert.equal(added.data.result.revision, 1);
  assert.equal(added.data.result.watchlist[0].symbol, "BTCUSDT");
  assert.deepEqual((await rpc("watchlistCommand", watchlistAdd, alice)).data, added.data);
  const commandStatus = await rpc(
    "commandStatus",
    {
      commandType: watchlistAdd.commandType,
      idempotencyKey: watchlistAdd.idempotencyKey,
    },
    alice,
  );
  assert.deepEqual(commandStatus.data, added.data);
  assert.equal(
    (await rpc("watchlistCommand", { ...watchlistAdd, symbol: "ETHUSDT" }, alice)).status,
    409,
  );
  assert.equal(
    (
      await rpc(
        "watchlistCommand",
        { ...watchlistAdd, idempotencyKey: randomBytes(16).toString("hex"), symbol: "ETHUSDT" },
        alice,
      )
    ).status,
    409,
  );
  assert.deepEqual((await rpc("overview", {}, bob)).data.data.watchlist, []);
  assert.equal((await rpc("overview", {}, alice)).data.data.watchlist[0].symbol, "BTCUSDT");
  const removed = await rpc(
    "watchlistCommand",
    {
      ...watchlistAdd,
      commandType: "watchlist.remove",
      idempotencyKey: randomBytes(16).toString("hex"),
      expectedRevision: 1,
    },
    alice,
  );
  assert.equal(removed.status, 200);
  assert.equal(removed.data.result.revision, 2);
  assert.deepEqual(removed.data.result.watchlist, []);
  check(
    "financial watchlist commands persist once, reject conflicting keys/revisions and isolate users",
  );
  // Stop this verifier's worker before creating source fixtures. No RSS requests
  // or scheduled brief publications may run against the disposable fixture data.
  await stop("worker");
  assert.equal((await rpc("intelligence/list")).status, 401);
  for (const url of [
    "https://127.0.0.1/feed.xml",
    "https://localhost/feed.xml",
    "https://10.0.0.1/feed.xml",
    "https://169.254.169.254/feed.xml",
    "https://[::1]/feed.xml",
    "http://example.com/feed.xml",
    "https://user:password@example.com/feed.xml",
  ]) {
    assert.equal(
      (
        await rpc(
          "intelligence/createSource",
          { name: "Rejected fixture", url, kind: "market" },
          alice,
        )
      ).status,
      400,
    );
  }
  assert.equal(await financialDb.prisma.intelligenceSource.count(), 0);
  check("authenticated source creation rejects private, loopback, metadata and credential URLs");
  // A literal public IP avoids any DNS dependency; this URL is never fetched.
  const sourceInput = {
    name: "Integration fixture source",
    url: `https://93.184.216.34/verification-${runId}.xml`,
    kind: "author",
  };
  const source = await rpc("intelligence/createSource", sourceInput, alice);
  assert.equal(source.status, 200);
  assert.deepEqual((await rpc("intelligence/createSource", sourceInput, alice)).data, source.data);
  assert.equal(
    (await rpc("intelligence/setSourceEnabled", { id: source.data.id, enabled: false }, bob))
      .status,
    404,
  );
  const disabledSource = await rpc(
    "intelligence/setSourceEnabled",
    { id: source.data.id, enabled: false },
    alice,
  );
  assert.equal(disabledSource.status, 200);
  assert.equal(disabledSource.data.enabled, false);
  const subscriptionInput = {
    name: "Fixture Bitcoin subscription",
    sourceId: source.data.id,
    includeTerms: ["Bitcoin"],
    excludeTerms: ["sponsored"],
  };
  assert.equal((await rpc("intelligence/createSubscription", subscriptionInput, bob)).status, 404);
  const subscription = await rpc("intelligence/createSubscription", subscriptionInput, alice);
  assert.equal(subscription.status, 200);
  assert.deepEqual(
    (await rpc("intelligence/createSubscription", subscriptionInput, alice)).data,
    subscription.data,
  );
  assert.equal(await financialDb.prisma.intelligenceSubscription.count(), 1);
  const disableSubscription = {
    id: subscription.data.id,
    expectedRevision: subscription.data.revision,
    enabled: false,
  };
  assert.equal(
    (await rpc("intelligence/setSubscriptionEnabled", disableSubscription, bob)).status,
    404,
  );
  const disabledSubscription = await rpc(
    "intelligence/setSubscriptionEnabled",
    disableSubscription,
    alice,
  );
  assert.equal(disabledSubscription.status, 200);
  assert.equal(disabledSubscription.data.enabled, false);
  assert.equal(
    (await rpc("intelligence/setSubscriptionEnabled", disableSubscription, alice)).status,
    409,
  );
  const enabledSubscription = await rpc(
    "intelligence/setSubscriptionEnabled",
    {
      ...disableSubscription,
      expectedRevision: disabledSubscription.data.revision,
      enabled: true,
    },
    alice,
  );
  assert.equal(enabledSubscription.status, 200);
  assert.equal(enabledSubscription.data.enabled, true);
  const preferences = {
    timezone: "UTC",
    digestHour: 8,
    pushEnabled: false,
    quietStart: 22,
    quietEnd: 8,
  };
  const prefs = await rpc("intelligence/updatePreferences", preferences, alice);
  assert.equal(prefs.status, 200);
  assert.deepEqual(prefs.data, preferences);
  check("source/subscription controls enforce ownership and revisions; preferences persist");
  check(
    "subscription creation rejects another user's source and deduplicates identical configurations",
  );
  // Only seed this isolated verification DB. Fixture content is clearly labelled
  // and tests archives/feedback; production RSS capture has separate feed tests.
  const fixtureTime = new Date();
  const content = await financialDb.prisma.intelligenceContent.create({
    data: {
      sourceId: source.data.id,
      externalKey: `fixture:${runId}`,
      hash: randomBytes(32).toString("hex"),
      revision: 1,
      sourceName: sourceInput.name,
      author: "Integration fixture author",
      title: "Integration fixture: Bitcoin archive test",
      excerpt: "Synthetic verification content; this is not market news or a trading signal.",
      url: `https://example.com/fixture-${runId}`,
      publishedAt: fixtureTime,
      firstSeenAt: fixtureTime,
    },
  });
  const recommendation = await financialDb.prisma.intelligenceRecommendation.create({
    data: {
      userId: alice.id,
      contentId: content.id,
      subscriptionSnapshot: [subscription.data],
      reason: "Integration fixture matched Bitcoin",
      matchedTerms: ["Bitcoin"],
    },
  });
  const aliceIntelligence = await rpc("intelligence/list", {}, alice);
  assert.equal(aliceIntelligence.status, 200);
  assert.equal(aliceIntelligence.data.sources.length, 1);
  assert.equal(aliceIntelligence.data.subscriptions.length, 1);
  assert.equal(aliceIntelligence.data.recommendations[0].id, recommendation.id);
  const bobIntelligence = (await rpc("intelligence/list", {}, bob)).data;
  for (const field of ["sources", "subscriptions", "recommendations", "briefs"]) {
    assert.deepEqual(bobIntelligence[field], []);
  }
  assert.equal(bobIntelligence.preferences.pushEnabled, true);
  assert.deepEqual(aliceIntelligence.data.preferences, preferences);
  assert.equal((await rpc("intelligence/list", { userId: alice.id }, bob)).status, 400);
  check("source, subscription and recommendation lists are scoped to the authenticated user");
  const [brief, retry, concurrentRetry] = await Promise.all([
    rpc("intelligence/publishBrief", {}, alice),
    rpc("intelligence/publishBrief", {}, alice),
    rpc("intelligence/publishBrief", {}, alice),
  ]);
  assert.equal(brief.status, 200);
  assert.equal(retry.status, 200);
  assert.equal(concurrentRetry.status, 200);
  assert.deepEqual(retry.data, brief.data);
  assert.deepEqual(concurrentRetry.data, brief.data);
  assert.equal(brief.data.items[0].id, recommendation.id);
  assert.equal(brief.data.version, 1);
  assert.equal(brief.data.timezone, "UTC");
  assert.equal(brief.data.coverage.totalCount, 1);
  assert.equal(brief.data.coverage.truncated, false);
  assert.equal(brief.data.correctionReason, null);
  assert.equal(
    await financialDb.prisma.intelligenceBrief.count({ where: { userId: alice.id } }),
    1,
  );
  assert.equal(
    await financialDb.prisma.financeNotification.count({
      where: { userId: alice.id, eventId: `intelligence.daily:${brief.data.id}` },
    }),
    1,
  );
  check("concurrent same-day brief publication returns one immutable archive and one notification");
  assert.equal(
    (await rpc("intelligence/feedback", { id: recommendation.id, value: "useful" }, bob)).status,
    404,
  );
  assert.equal(await financialDb.prisma.intelligenceFeedback.count(), 0);
  assert.equal(
    (await rpc("intelligence/feedback", { id: recommendation.id, value: "useful" }, alice)).status,
    200,
  );
  assert.equal(await financialDb.prisma.intelligenceFeedback.count(), 1);
  const afterFeedback = await rpc("intelligence/list", {}, alice);
  assert.equal(afterFeedback.data.recommendations[0].feedback, "useful");
  assert.deepEqual(afterFeedback.data.briefs[0], brief.data);
  assert.deepEqual((await rpc("intelligence/publishBrief", {}, alice)).data, brief.data);
  assert.deepEqual((await rpc("intelligence/list", {}, bob)).data.briefs, []);
  assert.deepEqual((await rpc("notifications", {}, bob)).data.items, []);
  check(
    "cross-user recommendation feedback is rejected and own feedback preserves the published archive",
  );
  const correction = {
    briefId: brief.data.id,
    expectedVersion: 1,
    reason: "Synthetic verification correction",
  };
  assert.equal((await rpc("intelligence/correctBrief", correction, bob)).status, 404);
  const corrected = await rpc("intelligence/correctBrief", correction, alice);
  assert.equal(corrected.status, 200);
  assert.equal(corrected.data.version, 2);
  assert.equal(corrected.data.parentId, brief.data.id);
  assert.deepEqual(
    (await rpc("intelligence/correctBrief", correction, alice)).data,
    corrected.data,
  );
  assert.equal(
    (
      await rpc(
        "intelligence/correctBrief",
        { ...correction, reason: "Conflicting correction" },
        alice,
      )
    ).status,
    409,
  );
  const archives = (await rpc("intelligence/list", {}, alice)).data.briefs;
  assert.deepEqual(
    archives.find((entry: { id: string }) => entry.id === brief.data.id),
    brief.data,
  );
  assert.equal(
    await financialDb.prisma.financeNotification.count({
      where: { userId: alice.id, eventId: `intelligence.daily:${corrected.data.id}` },
    }),
    1,
  );
  const delivery = await rpc("notifications", {}, alice);
  for (const item of delivery.data.items) {
    assert.equal(typeof item.pushStatus, "string");
    assert.equal(typeof item.pushAttempts, "number");
    assert("lastPushAt" in item);
  }
  check("explicit correction creates one immutable v2 archive; inbox exposes delivery state");
  if (withWeb) {
    // The fixture source remains disabled; restart only our worker so manual
    // browser checks can exercise newly added public feeds in this isolated DB.
    start("worker", [path.join(runtime, "pnpm"), "--filter", "@marketbot/worker", "start"]);
    start("web", [path.join(runtime, "pnpm"), "--filter", "@marketbot/web", "dev"]);
    await health(webUrl);
    check("Web verification server started");
  }
  passed = true;
  privateJson("result.json", {
    passed,
    checks,
    mode: "assistant_bridge",
    syntheticEvent: true,
    actualSimulationFill: false,
    syntheticIntelligenceFixture: true,
    externalFeedsFetched: false,
    kept: keep,
  });
  process.stdout.write(
    `Verification passed: ${checks.length} checks. Private artifacts: ${directory}\n`,
  );
  if (keep)
    process.stdout.write(
      `Verification services kept for UI checks: ${withWeb ? webUrl : apiUrl}\n`,
    );
} finally {
  if (financialDb) {
    await financialDb.prisma.$disconnect();
    await financialDb.pool.end();
  }
  if (!keep || !passed) {
    for (const name of [...children.keys()].reverse()) await stop(name);
    await admin.query(`DROP DATABASE IF EXISTS "${databaseName}" WITH (FORCE)`);
  }
  await admin.end();
}
