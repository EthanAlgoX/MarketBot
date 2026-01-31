
import { createHash, randomBytes } from "node:crypto";
import { createServer } from "node:http";
import fs from "fs/promises";
import path from "path";
import os from "os";

// Constants for Google OAuth
const CLIENT_ID = "YOUR_CLIENT_ID_HERE"; // Ideally this comes from build-time env or similar
const AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN_URL = "https://oauth2.googleapis.com/token";
const REDIRECT_URI = "http://localhost:8085/oauth2callback";
const SCOPES = [
    "https://www.googleapis.com/auth/cloud-platform",
    "https://www.googleapis.com/auth/userinfo.email"
];

const CREDENTIALS_DIR = path.join(os.homedir(), ".marketbot");
const CREDENTIALS_FILE = path.join(CREDENTIALS_DIR, "credentials.json");

export interface OAuthCredentials {
    access_token: string;
    refresh_token: string;
    expires_at: number;
    email?: string;
    project_id?: string;
}

export async function login(): Promise<OAuthCredentials> {
    const { verifier, challenge } = generatePkce();
    const authUrl = buildAuthUrl(challenge, verifier);

    console.log("\nPlease open the following URL in your browser to log in:");
    console.log(authUrl);
    console.log("\nWaiting for authentication...");

    const { code } = await waitForLocalCallback(verifier);
    const tokens = await exchangeCodeForTokens(code, verifier);

    await saveCredentials(tokens);
    console.log("Successfully logged in!");
    return tokens;
}

export async function logout(): Promise<void> {
    try {
        await fs.unlink(CREDENTIALS_FILE);
        console.log("Logged out.");
    } catch (err) {
        if ((err as any).code !== "ENOENT") throw err;
        console.log("Already logged out.");
    }
}

export async function getCredentials(): Promise<OAuthCredentials | null> {
    try {
        const data = await fs.readFile(CREDENTIALS_FILE, "utf-8");
        const creds = JSON.parse(data) as OAuthCredentials;

        // Simple check if expired (with buffer)
        if (Date.now() > creds.expires_at - 60000) {
            // TODO: Implement refresh logic here
            console.warn("Token expired. Please login again.");
            return null;
        }
        return creds;
    } catch {
        return null;
    }
}

async function saveCredentials(creds: OAuthCredentials) {
    await fs.mkdir(CREDENTIALS_DIR, { recursive: true });
    await fs.writeFile(CREDENTIALS_FILE, JSON.stringify(creds, null, 2));
}

function generatePkce() {
    const verifier = randomBytes(32).toString("base64url");
    const challenge = createHash("sha256").update(verifier).digest("base64url");
    return { verifier, challenge };
}

function buildAuthUrl(challenge: string, state: string): string {
    const params = new URLSearchParams({
        client_id: process.env.GOOGLE_CLIENT_ID || "CLIENT_ID_MISSING", // Expect env var or build config
        redirect_uri: REDIRECT_URI,
        response_type: "code",
        scope: SCOPES.join(" "),
        code_challenge: challenge,
        code_challenge_method: "S256",
        state: state,
        access_type: "offline",
        prompt: "consent"
    });
    return `${AUTH_URL}?${params.toString()}`;
}

async function waitForLocalCallback(expectedState: string): Promise<{ code: string }> {
    return new Promise((resolve, reject) => {
        const server = createServer((req, res) => {
            try {
                const url = new URL(req.url || "", `http://localhost:8085`);
                if (url.pathname !== "/oauth2callback") {
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

                if (state !== expectedState) {
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

        server.listen(8085, () => {
            // Server listening
        });
    });
}

async function exchangeCodeForTokens(code: string, verifier: string): Promise<OAuthCredentials> {
    const params = new URLSearchParams({
        client_id: process.env.GOOGLE_CLIENT_ID || "",
        client_secret: process.env.GOOGLE_CLIENT_SECRET || "",
        code,
        grant_type: "authorization_code",
        redirect_uri: REDIRECT_URI,
        code_verifier: verifier
    });

    const resp = await fetch(TOKEN_URL, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: params
    });

    if (!resp.ok) {
        const text = await resp.text();
        throw new Error(`Token exchange failed: ${text}`);
    }

    const data = await resp.json();
    return {
        access_token: data.access_token,
        refresh_token: data.refresh_token,
        expires_at: Date.now() + (data.expires_in * 1000),
        // In a real impl, fetch user info to get email
    };
}
