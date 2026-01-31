/*
 * Copyright (C) 2026 MarketBot
 *
 * This file is part of MarketBot.
 *
 * MarketBot is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as
 * published by the Free Software Foundation, either version 3 of the
 * License, or (at your option) any later version.
 *
 * MarketBot is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with MarketBot.  If not, see <https://www.gnu.org/licenses/>.
 */

import { describe, expect, test } from "vitest";
import { createNodeSubscriptionManager } from "./server-node-subscriptions.js";

describe("node subscription manager", () => {
  test("routes events to subscribed nodes", () => {
    const manager = createNodeSubscriptionManager();
    const sent: Array<{
      nodeId: string;
      event: string;
      payloadJSON?: string | null;
    }> = [];
    const sendEvent = (evt: { nodeId: string; event: string; payloadJSON?: string | null }) =>
      sent.push(evt);

    manager.subscribe("node-a", "main");
    manager.subscribe("node-b", "main");
    manager.sendToSession("main", "chat", { ok: true }, sendEvent);

    expect(sent).toHaveLength(2);
    expect(sent.map((s) => s.nodeId).toSorted()).toEqual(["node-a", "node-b"]);
    expect(sent[0].event).toBe("chat");
  });

  test("unsubscribeAll clears session mappings", () => {
    const manager = createNodeSubscriptionManager();
    const sent: string[] = [];
    const sendEvent = (evt: { nodeId: string; event: string }) =>
      sent.push(`${evt.nodeId}:${evt.event}`);

    manager.subscribe("node-a", "main");
    manager.subscribe("node-a", "secondary");
    manager.unsubscribeAll("node-a");
    manager.sendToSession("main", "tick", {}, sendEvent);
    manager.sendToSession("secondary", "tick", {}, sendEvent);

    expect(sent).toEqual([]);
  });
});
