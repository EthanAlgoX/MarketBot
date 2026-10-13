// Modified for marketbot on 2026-10-13; see MODIFICATIONS.md.
export { DestinationEmulator, McpEmulator } from "@marketbot/adapters";

export function sessionCookieHeader(response: Response) {
  const cookies = response.headers.getSetCookie?.() ?? [];
  if (cookies.length) return cookies.map((cookie) => cookie.split(";")[0]).join("; ");
  return response.headers.get("set-cookie")?.split(",")[0]?.split(";")[0] ?? "";
}
