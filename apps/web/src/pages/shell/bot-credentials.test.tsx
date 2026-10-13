// @vitest-environment jsdom
// Modified for marketbot on 2026-10-13; see MODIFICATIONS.md.

import { encodeLoginSecret } from "@marketbot/contracts";
import type { ComponentProps, ReactNode } from "react";
import { act } from "react";
import type { Root } from "react-dom/client";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const botSecrets = vi.hoisted(() => ({
  list: vi.fn(),
  put: vi.fn(),
  remove: vi.fn(),
}));

vi.mock("../../lib/rpc", () => ({ rpc: { botSecrets } }));
vi.mock("@lingui/react/macro", () => {
  const t = (parts: TemplateStringsArray, ...values: unknown[]) =>
    parts.reduce((text, part, index) => `${text}${index > 0 ? values[index - 1] : ""}${part}`, "");
  return { useLingui: () => ({ t }), Trans: ({ children }: { children: ReactNode }) => children };
});
vi.mock("@marketbot/ui-web", () => ({
  Button: ({
    variant: _variant,
    size: _size,
    ...props
  }: ComponentProps<"button"> & { variant?: string; size?: string }) => <button {...props} />,
  Input: (props: ComponentProps<"input">) => <input {...props} />,
  NativeSelect: (props: ComponentProps<"select">) => <select {...props} />,
  NativeSelectOption: (props: ComponentProps<"option">) => <option {...props} />,
}));

import { BotCredentialsSection } from "./bot-credentials";

const FAKE_VALUE = "fake-value-SENTINEL-1";
const stamp = "2026-09-01T00:00:00.000Z";
const rows = [
  { name: "api", origin: "https://api.example.com", auth: { type: "bearer" } },
  {
    name: "custom",
    origin: "https://svc.example.com",
    auth: { type: "header", name: "X-Api-Key" },
  },
  {
    name: "router",
    origin: "http://192.168.1.20:8080",
    auth: { type: "basic", username: "admin" },
  },
  { name: "portal", origin: "https://portal.example.com", auth: { type: "login" } },
].map((row) => ({ ...row, createdAt: stamp, updatedAt: stamp }));

let container: HTMLDivElement;
let root: Root;

async function flush() {
  await act(async () => {
    await Promise.resolve();
  });
}

async function render() {
  await act(async () => {
    root.render(<BotCredentialsSection botId="bot-1" />);
  });
  await flush();
}

function byTestId<T extends HTMLElement>(testId: string): T {
  const found = container.querySelector<T>(`[data-testid="${testId}"]`);
  if (!found) throw new Error(`Missing element: ${testId}`);
  return found;
}

async function type(testId: string, value: string) {
  const element = byTestId<HTMLInputElement | HTMLSelectElement>(testId);
  const prototype =
    element instanceof HTMLSelectElement ? HTMLSelectElement.prototype : HTMLInputElement.prototype;
  await act(async () => {
    Object.getOwnPropertyDescriptor(prototype, "value")?.set?.call(element, value);
    element.dispatchEvent(
      new Event(element instanceof HTMLSelectElement ? "change" : "input", { bubbles: true }),
    );
  });
}

async function click(testId: string) {
  await act(async () => {
    byTestId<HTMLButtonElement>(testId).click();
  });
  await flush();
}

beforeEach(() => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  botSecrets.list.mockReset().mockResolvedValue(rows);
  botSecrets.put.mockReset();
  botSecrets.remove.mockReset().mockResolvedValue({ ok: true });
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
});

afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
  vi.unstubAllGlobals();
});

describe("BotCredentialsSection", () => {
  it("lists credential metadata and no values", async () => {
    await render();
    expect(botSecrets.list).toHaveBeenCalledWith({ botId: "bot-1" });
    const text = container.textContent ?? "";
    expect(container.querySelectorAll('[data-testid="bot-credential-row"]')).toHaveLength(4);
    for (const expected of [
      "https://api.example.com",
      "Bearer token",
      'Header "X-Api-Key"',
      "http://192.168.1.20:8080",
      "Basic auth (admin)",
      "Website login",
    ]) {
      expect(text).toContain(expected);
    }
    expect(container.querySelectorAll("input")).toHaveLength(0);
  });

  it("shows an empty state", async () => {
    botSecrets.list.mockResolvedValue([]);
    await render();
    expect(byTestId("bot-credentials-empty").textContent).toContain("No credentials saved");
  });

  it("adds a header credential and clears the value, then refetches", async () => {
    botSecrets.put.mockResolvedValue(rows[1]);
    await render();
    await click("credential-add");
    await type("credential-name", "custom");
    await type("credential-origin", "https://svc.example.com");
    await type("credential-auth-type", "header");
    await type("credential-header-name", "X-Api-Key");
    await type("credential-value", FAKE_VALUE);
    expect(byTestId<HTMLInputElement>("credential-value").type).toBe("password");
    expect(byTestId<HTMLInputElement>("credential-value").autocomplete).toBe("new-password");
    await click("credential-add-save");

    expect(botSecrets.put).toHaveBeenCalledWith({
      botId: "bot-1",
      destination: {
        name: "custom",
        origin: "https://svc.example.com",
        auth: { type: "header", name: "X-Api-Key" },
      },
      value: FAKE_VALUE,
    });
    expect(botSecrets.list).toHaveBeenCalledTimes(2);
    expect(container.innerHTML).not.toContain(FAKE_VALUE);
  });

  it("clears the value and shows the server error when saving fails", async () => {
    botSecrets.put.mockRejectedValue(
      new Error("Invalid credential destination — origin: Expected an HTTPS origin"),
    );
    await render();
    await click("credential-add");
    await type("credential-name", "router2");
    await type("credential-origin", "http://192.168.1.21");
    await type("credential-value", FAKE_VALUE);
    await click("credential-add-save");

    expect(botSecrets.put).toHaveBeenCalledTimes(1);
    expect(byTestId<HTMLInputElement>("credential-value").value).toBe("");
    expect(container.querySelector('[role="alert"]')?.textContent).toContain(
      "Invalid credential destination",
    );
    expect(container.innerHTML).not.toContain(FAKE_VALUE);
  });

  it("encodes a website login with encodeLoginSecret", async () => {
    botSecrets.put.mockResolvedValue(rows[3]);
    await render();
    await click("credential-add");
    await type("credential-name", "portal2");
    await type("credential-origin", "https://portal.example.com");
    await type("credential-auth-type", "login");
    await type("credential-username", " jamie ");
    await type("credential-value", FAKE_VALUE);
    await click("credential-add-save");

    expect(botSecrets.put).toHaveBeenCalledWith({
      botId: "bot-1",
      destination: {
        name: "portal2",
        origin: "https://portal.example.com",
        auth: { type: "login" },
      },
      value: encodeLoginSecret({ username: "jamie", password: FAKE_VALUE }),
    });
  });

  it("replaces a value on the same destination", async () => {
    botSecrets.put.mockResolvedValue(rows[2]);
    await render();
    await click("credential-replace-router");
    await type("credential-replace-value", FAKE_VALUE);
    await click("credential-replace-save");

    expect(botSecrets.put).toHaveBeenCalledWith({
      botId: "bot-1",
      destination: {
        name: "router",
        origin: "http://192.168.1.20:8080",
        auth: { type: "basic", username: "admin" },
      },
      value: FAKE_VALUE,
    });
    expect(container.innerHTML).not.toContain(FAKE_VALUE);
  });

  it("shows an unreadable saved row with remove but no replace", async () => {
    botSecrets.list.mockResolvedValue([
      {
        name: "Legacy Name",
        origin: "https://legacy.example.com",
        auth: null,
        createdAt: stamp,
        updatedAt: stamp,
      },
    ]);
    await render();
    const row = byTestId("bot-credential-row");
    expect(row.textContent).toContain("These saved settings can't be read.");
    expect(container.querySelector('[data-testid="credential-replace-Legacy Name"]')).toBeNull();
    await click("credential-remove-Legacy Name");
    expect(container.textContent).toContain("Remove Legacy Name?");
    await click("credential-remove-confirm-Legacy Name");
    expect(botSecrets.remove).toHaveBeenCalledWith({ botId: "bot-1", name: "Legacy Name" });
    expect(botSecrets.list).toHaveBeenCalledTimes(2);
  });

  it("hides replace and shows the unreadable row when a readable auth has an invalid name", async () => {
    botSecrets.list.mockResolvedValue([
      {
        name: "Legacy Name",
        origin: "https://legacy.example.com",
        auth: { type: "bearer" },
        createdAt: stamp,
        updatedAt: stamp,
      },
    ]);
    await render();
    const row = byTestId("bot-credential-row");
    expect(row.textContent).toContain("These saved settings can't be read.");
    expect(container.querySelector('[data-testid="credential-replace-Legacy Name"]')).toBeNull();
    await click("credential-remove-Legacy Name");
    expect(container.textContent).toContain("Remove Legacy Name?");
    await click("credential-remove-confirm-Legacy Name");
    expect(botSecrets.remove).toHaveBeenCalledWith({ botId: "bot-1", name: "Legacy Name" });
    expect(botSecrets.list).toHaveBeenCalledTimes(2);
  });

  it("keeps the add form open when save succeeds but list reload fails", async () => {
    botSecrets.put.mockResolvedValue(rows[0]);
    botSecrets.list.mockResolvedValueOnce(rows).mockRejectedValueOnce(new Error("list failed"));
    await render();
    await click("credential-add");
    await type("credential-name", "api2");
    await type("credential-origin", "https://api.example.com");
    await type("credential-value", FAKE_VALUE);
    await click("credential-add-save");

    expect(botSecrets.put).toHaveBeenCalledTimes(1);
    expect(container.querySelector('[data-testid="credential-add-form"]')).not.toBeNull();
    expect(container.querySelector('[role="alert"]')?.textContent).toContain(
      "Could not load credentials.",
    );
    expect(container.innerHTML).not.toContain(FAKE_VALUE);
  });

  it("clears a typed replace value when opening remove on another row", async () => {
    await render();
    await click("credential-replace-api");
    await type("credential-replace-value", FAKE_VALUE);
    expect(byTestId<HTMLInputElement>("credential-replace-value").value).toBe(FAKE_VALUE);
    await click("credential-remove-custom");
    expect(container.querySelector('[data-testid="credential-replace-value"]')).toBeNull();
    expect(container.textContent).toContain("Remove custom?");
    // Protected value must not linger in any live input.
    const leaked = Array.from(container.querySelectorAll("input, textarea")).some((input) =>
      (input as HTMLInputElement).value.includes(FAKE_VALUE),
    );
    expect(leaked).toBe(false);
  });

  it("removes only after an explicit confirm", async () => {
    await render();
    await click("credential-remove-api");
    expect(botSecrets.remove).not.toHaveBeenCalled();
    expect(container.textContent).toContain("Remove api?");
    await click("credential-remove-confirm-api");
    expect(botSecrets.remove).toHaveBeenCalledWith({ botId: "bot-1", name: "api" });
    expect(botSecrets.list).toHaveBeenCalledTimes(2);
  });
});
