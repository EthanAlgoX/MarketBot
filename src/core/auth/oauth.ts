import { execSync } from "node:child_process";
import { createHash, randomBytes } from "node:crypto";
import { createServer } from "node:http";
import fs from "fs/promises";
import path from "path";
import os from "os";

export type OAuthProvider = "google" | "openai-codex";

export interface OAuthCredentials {
  access_token: string;
  refresh_token?: string;
  expires_at: number;
  email?: string;
  account_id?: string;
}

type OAuthStore = {
  version: 1;
  providers: Partial<Record<OAuthProvider, OAuthCredentials>>;
};

const CREDENTIALS_DIR = path.join(os.homedir(), ".marketbot");
const LEGACY_CREDENTIALS_FILE = path.join(CREDENTIALS_DIR, "credentials.json");
const OAUTH_STORE_FILE = path.join(CREDENTIALS_DIR, "oauth.json");

// Google OAuth
const GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const GOOGLE_REDIRECT_URI = "http://localhost:8085/oauth2callback";
const GOOGLE_SCOPES = [
  "https://www.googleapis.com/auth/cloud-platform",
  "https://www.googleapis.com/auth/userinfo.email",
];

// OpenAI Codex OAuth (ChatGPT subscription)
const OPENAI_AUTH_URL = "https://auth.openai.com/oauth/authorize";
const OPENAI_TOKEN_URL = "https://auth.openai.com/oauth/token";
const OPENAI_DEFAULT_REDIRECT_URI = "http://127.0.0.1:1455/auth/callback";
const OPENAI_DEFAULT_SCOPES = "openid profile email offline_access";

export async function login(provider: OAuthProvider = "google"): Promise<OAuthCredentials> {
  if (provider === "openai-codex") {
    const creds = await loginOpenAICodex();
    await saveCredentials("openai-codex", creds);
    return creds;
  }

  const creds = await loginGoogle();
  await saveCredentials("google", creds);
  return creds;
}

export async function logout(provider: OAuthProvider | "all" = "google"): Promise<void> {
  if (provider === "all") {
    await removeOAuthStore();
    await removeLegacyCredentials();
    console.log("Logged out (all providers).");
    return;
  }

  const store = await loadOAuthStore();
  if (store.providers[provider]) {
    delete store.providers[provider];
    await saveOAuthStore(store);
  }

  if (provider === "google") {
    await removeLegacyCredentials();
  }

  console.log(`Logged out (${provider}).`);
}

export async function getCredentials(provider: OAuthProvider = "google"): Promise<OAuthCredentials | null> {
  let creds = await readStoredCredentials(provider);

  if (!creds && provider === "openai-codex") {
    creds = await readCodexCliCredentials();
  }

  if (!creds && provider === "google") {
    creds = await readLegacyGoogleCredentials();
  }

  if (!creds) return null;

  if (isExpired(creds)) {
    const refreshed = await tryRefresh(provider, creds);
    if (refreshed) {
      await saveCredentials(provider, refreshed);
      return refreshed;
    }
    console.warn("Token expired. Please login again.");
    return null;
  }

  return creds;
}

async function loginGoogle(): Promise<OAuthCredentials> {
  const { verifier, challenge } = generatePkce();
  const authUrl = buildGoogleAuthUrl(challenge, verifier);

  console.log("\nPlease open the following URL in your browser to log in:");
  console.log(authUrl);
  console.log("\nWaiting for authentication...");

  const { code } = await waitForLocalCallback({
    expectedState: verifier,
    redirectUri: GOOGLE_REDIRECT_URI,
  });
  const tokens = await exchangeGoogleCodeForTokens(code, verifier);
  console.log("Successfully logged in!");
  return tokens;
}

async function loginOpenAICodex(): Promise<OAuthCredentials> {
  const clientId = process.env.OPENAI_OAUTH_CLIENT_ID;
  if (!clientId) {
    throw new Error("Missing OPENAI_OAUTH_CLIENT_ID. Set it to enable OpenAI OAuth.");
  }

  const { verifier, challenge } = generatePkce();
  const state = randomBytes(16).toString("hex");
  const redirectUri = resolveOpenAiRedirectUri();
  const authUrl = buildOpenAiAuthUrl({
    clientId,
    redirectUri,
    state,
    challenge,
  });

  console.log("\nPlease open the following URL in your browser to log in:");
  console.log(authUrl);
  console.log("\nWaiting for authentication...");

  const { code } = await waitForLocalCallback({
    expectedState: state,
    redirectUri,
  });
  const tokens = await exchangeOpenAiCodeForTokens(code, verifier, clientId, redirectUri);
  console.log("Successfully logged in!");
  return tokens;
}

async function exchangeGoogleCodeForTokens(code: string, verifier: string): Promise<OAuthCredentials> {
  const params = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID || "",
    client_secret: process.env.GOOGLE_CLIENT_SECRET || "",
    code,
    grant_type: "authorization_code",
    redirect_uri: GOOGLE_REDIRECT_URI,
    code_verifier: verifier,
  });

  const resp = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: params,
  });

  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`Token exchange failed: ${text}`);
  }

  const data = await resp.json();
  return {
    access_token: data.access_token,
    refresh_token: data.refresh_token,
    expires_at: Date.now() + data.expires_in * 1000,
  };
}

async function exchangeOpenAiCodeForTokens(
  code: string,
  verifier: string,
  clientId: string,
  redirectUri: string,
): Promise<OAuthCredentials> {
  const params = new URLSearchParams({
    client_id: clientId,
    code,
    grant_type: "authorization_code",
    redirect_uri: redirectUri,
    code_verifier: verifier,
  });

  if (process.env.OPENAI_OAUTH_CLIENT_SECRET) {
    params.set("client_secret", process.env.OPENAI_OAUTH_CLIENT_SECRET);
  }

  const resp = await fetch(OPENAI_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: params,
  });

  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`Token exchange failed: ${text}`);
  }

  const data = await resp.json();
  return normalizeOpenAiTokens(data);
}

function buildGoogleAuthUrl(challenge: string, state: string): string {
  const params = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID || "CLIENT_ID_MISSING",
    redirect_uri: GOOGLE_REDIRECT_URI,
    response_type: "code",
    scope: GOOGLE_SCOPES.join(" "),
    code_challenge: challenge,
    code_challenge_method: "S256",
    state: state,
    access_type: "offline",
    prompt: "consent",
  });
  return `${GOOGLE_AUTH_URL}?${params.toString()}`;
}

function buildOpenAiAuthUrl(params: {
  clientId: string;
  redirectUri: string;
  state: string;
  challenge: string;
}): string {
  const scopes = resolveOpenAiScopes();
  const urlParams = new URLSearchParams({
    client_id: params.clientId,
    redirect_uri: params.redirectUri,
    response_type: "code",
    scope: scopes,
    code_challenge: params.challenge,
    code_challenge_method: "S256",
    state: params.state,
  });
  return `${OPENAI_AUTH_URL}?${urlParams.toString()}`;
}

async function waitForLocalCallback(params: {
  expectedState: string;
  redirectUri: string;
}): Promise<{ code: string }> {
  return new Promise((resolve, reject) => {
    const redirect = new URL(params.redirectUri);
    const port = redirect.port ? Number(redirect.port) : redirect.protocol === "https:" ? 443 : 80;
    const hostname = redirect.hostname || "127.0.0.1";
    const expectedPath = redirect.pathname || "/";

    const server = createServer((req, res) => {
      try {
        const url = new URL(req.url || "", params.redirectUri);
        if (url.pathname !== expectedPath) {
          res.writeHead(404);
          res.end("Not Found");
          return;
        }

        const code = url.searchParams.get("code");
        const state = url.searchParams.get("state");
        const error = url.searchParams.get("error");

        if (error) {
          res.writeHead(400);
          res.end(`Authentication failed: ${error}`);
          server.close();
          reject(new Error(error));
          return;
        }

        if (state !== params.expectedState) {
          res.writeHead(400);
          res.end("Invalid state");
          server.close();
          reject(new Error("State mismatch"));
          return;
        }

        if (code) {
          res.writeHead(200, { "Content-Type": "text/html" });
          res.end("<h1>Authenticated!</h1><p>You can close this window now.</p>");
          server.close();
          resolve({ code });
        }
      } catch (err) {
        server.close();
        reject(err);
      }
    });

    server.listen(port, hostname, () => {
      // Server listening
    });
  });
}

function generatePkce() {
  const verifier = randomBytes(32).toString("base64url");
  const challenge = createHash("sha256").update(verifier).digest("base64url");
  return { verifier, challenge };
}

async function loadOAuthStore(): Promise<OAuthStore> {
  try {
    const data = await fs.readFile(OAUTH_STORE_FILE, "utf-8");
    const parsed = JSON.parse(data) as OAuthStore;
    if (parsed && parsed.version === 1 && parsed.providers) {
      return parsed;
    }
  } catch {
    // ignore
  }
  return { version: 1, providers: {} };
}

async function saveOAuthStore(store: OAuthStore): Promise<void> {
  await fs.mkdir(CREDENTIALS_DIR, { recursive: true });
  await fs.writeFile(OAUTH_STORE_FILE, JSON.stringify(store, null, 2));
}

async function saveCredentials(provider: OAuthProvider, creds: OAuthCredentials): Promise<void> {
  const store = await loadOAuthStore();
  store.providers[provider] = creds;
  await saveOAuthStore(store);
}

async function readStoredCredentials(provider: OAuthProvider): Promise<OAuthCredentials | null> {
  const store = await loadOAuthStore();
  const creds = store.providers[provider];
  if (!creds) return null;
  return creds;
}

async function readLegacyGoogleCredentials(): Promise<OAuthCredentials | null> {
  try {
    const data = await fs.readFile(LEGACY_CREDENTIALS_FILE, "utf-8");
    const creds = JSON.parse(data) as OAuthCredentials;
    if (!creds?.access_token || !creds?.expires_at) return null;
    return creds;
  } catch {
    return null;
  }
}

async function removeOAuthStore(): Promise<void> {
  try {
    await fs.unlink(OAUTH_STORE_FILE);
  } catch (err) {
    if ((err as any).code !== "ENOENT") throw err;
  }
}

async function removeLegacyCredentials(): Promise<void> {
  try {
    await fs.unlink(LEGACY_CREDENTIALS_FILE);
  } catch (err) {
    if ((err as any).code !== "ENOENT") throw err;
  }
}

function isExpired(creds: OAuthCredentials): boolean {
  return Date.now() > creds.expires_at - 60_000;
}

async function tryRefresh(provider: OAuthProvider, creds: OAuthCredentials): Promise<OAuthCredentials | null> {
  if (provider !== "openai-codex") return null;
  return refreshOpenAiTokens(creds);
}

async function refreshOpenAiTokens(creds: OAuthCredentials): Promise<OAuthCredentials | null> {
  if (!creds.refresh_token) return null;
  const clientId = process.env.OPENAI_OAUTH_CLIENT_ID;
  if (!clientId) return null;

  const params = new URLSearchParams({
    client_id: clientId,
    grant_type: "refresh_token",
    refresh_token: creds.refresh_token,
  });

  if (process.env.OPENAI_OAUTH_CLIENT_SECRET) {
    params.set("client_secret", process.env.OPENAI_OAUTH_CLIENT_SECRET);
  }

  const resp = await fetch(OPENAI_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: params,
  });

  if (!resp.ok) {
    const text = await resp.text();
    console.warn(`OpenAI token refresh failed: ${text}`);
    return null;
  }

  const data = await resp.json();
  const next = normalizeOpenAiTokens(data);
  if (!next.refresh_token) {
    next.refresh_token = creds.refresh_token;
  }
  return next;
}

function normalizeOpenAiTokens(data: Record<string, any>): OAuthCredentials {
  const accessToken = String(data.access_token || "");
  const refreshToken = typeof data.refresh_token === "string" ? data.refresh_token : undefined;
  if (!accessToken) {
    throw new Error("OpenAI OAuth response missing access_token");
  }

  const { exp, accountId, email } = decodeJwt(accessToken);
  const expiresAt =
    typeof exp === "number"
      ? exp * 1000
      : typeof data.expires_in === "number"
        ? Date.now() + data.expires_in * 1000
        : Date.now() + 60 * 60 * 1000;

  return {
    access_token: accessToken,
    refresh_token: refreshToken,
    expires_at: expiresAt,
    account_id: accountId,
    email,
  };
}

function decodeJwt(token: string): { exp?: number; accountId?: string; email?: string } {
  try {
    const parts = token.split(".");
    if (parts.length < 2) return {};
    const payload = JSON.parse(base64UrlDecode(parts[1])) as Record<string, unknown>;
    const exp = typeof payload.exp === "number" ? payload.exp : undefined;
    const accountId =
      typeof payload.account_id === "string"
        ? payload.account_id
        : typeof payload.accountId === "string"
          ? payload.accountId
          : undefined;
    const email = typeof payload.email === "string" ? payload.email : undefined;
    return { exp, accountId, email };
  } catch {
    return {};
  }
}

function base64UrlDecode(value: string): string {
  const padded = value.replace(/-/g, "+").replace(/_/g, "/");
  const padLength = (4 - (padded.length % 4)) % 4;
  const normalized = padded + "=".repeat(padLength);
  return Buffer.from(normalized, "base64").toString("utf8");
}

function resolveOpenAiRedirectUri(): string {
  return process.env.OPENAI_OAUTH_REDIRECT_URI || OPENAI_DEFAULT_REDIRECT_URI;
}

function resolveOpenAiScopes(): string {
  return process.env.OPENAI_OAUTH_SCOPES || OPENAI_DEFAULT_SCOPES;
}

function resolveUserPath(input: string): string {
  if (input.startsWith("~")) {
    return path.join(os.homedir(), input.slice(1));
  }
  return input;
}

function resolveCodexHomePath(): string {
  const configured = process.env.CODEX_HOME;
  return configured ? resolveUserPath(configured) : path.join(os.homedir(), ".codex");
}

function computeCodexKeychainAccount(codexHome: string): string {
  const hash = createHash("sha256").update(codexHome).digest("hex");
  return `cli|${hash.slice(0, 16)}`;
}

async function readCodexCliCredentials(): Promise<OAuthCredentials | null> {
  const keychain = readCodexKeychainCredentials();
  if (keychain) return keychain;

  const authPath = path.join(resolveCodexHomePath(), "auth.json");
  try {
    const raw = await fs.readFile(authPath, "utf-8");
    const data = JSON.parse(raw) as Record<string, any>;
    const tokens = data.tokens as Record<string, any> | undefined;
    const accessToken = tokens?.access_token;
    const refreshToken = tokens?.refresh_token;
    if (typeof accessToken !== "string" || !accessToken) return null;
    if (typeof refreshToken !== "string" || !refreshToken) return null;

    let expiresAt = Date.now() + 60 * 60 * 1000;
    try {
      const stat = await fs.stat(authPath);
      expiresAt = stat.mtimeMs + 60 * 60 * 1000;
    } catch {
      // ignore
    }

    const decoded = decodeJwt(accessToken);
    if (typeof decoded.exp === "number") {
      expiresAt = decoded.exp * 1000;
    }

    const accountId =
      typeof tokens?.account_id === "string" ? tokens.account_id : decoded.accountId;

    return {
      access_token: accessToken,
      refresh_token: refreshToken,
      expires_at: expiresAt,
      account_id: accountId,
      email: decoded.email,
    };
  } catch {
    return null;
  }
}

function readCodexKeychainCredentials(): OAuthCredentials | null {
  if (process.platform !== "darwin") return null;

  try {
    const codexHome = resolveCodexHomePath();
    const account = computeCodexKeychainAccount(codexHome);
    const secret = execSync(
      `security find-generic-password -s "Codex Auth" -a "${account}" -w`,
      {
        encoding: "utf8",
        timeout: 5000,
        stdio: ["pipe", "pipe", "pipe"],
      },
    ).trim();

    const parsed = JSON.parse(secret) as Record<string, any>;
    const tokens = parsed.tokens as Record<string, any> | undefined;
    const accessToken = tokens?.access_token;
    const refreshToken = tokens?.refresh_token;
    if (typeof accessToken !== "string" || !accessToken) return null;
    if (typeof refreshToken !== "string" || !refreshToken) return null;

    const decoded = decodeJwt(accessToken);
    const expiresAt =
      typeof decoded.exp === "number"
        ? decoded.exp * 1000
        : Date.now() + 60 * 60 * 1000;
    const accountId =
      typeof tokens?.account_id === "string" ? tokens.account_id : decoded.accountId;

    return {
      access_token: accessToken,
      refresh_token: refreshToken,
      expires_at: expiresAt,
      account_id: accountId,
      email: decoded.email,
    };
  } catch {
    return null;
  }
}
