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

export type NodeSendEventFn = (opts: {
  nodeId: string;
  event: string;
  payloadJSON?: string | null;
}) => void;

export type NodeListConnectedFn = () => Array<{ nodeId: string }>;

export type NodeSubscriptionManager = {
  subscribe: (nodeId: string, sessionKey: string) => void;
  unsubscribe: (nodeId: string, sessionKey: string) => void;
  unsubscribeAll: (nodeId: string) => void;
  sendToSession: (
    sessionKey: string,
    event: string,
    payload: unknown,
    sendEvent?: NodeSendEventFn | null,
  ) => void;
  sendToAllSubscribed: (
    event: string,
    payload: unknown,
    sendEvent?: NodeSendEventFn | null,
  ) => void;
  sendToAllConnected: (
    event: string,
    payload: unknown,
    listConnected?: NodeListConnectedFn | null,
    sendEvent?: NodeSendEventFn | null,
  ) => void;
  clear: () => void;
};

export function createNodeSubscriptionManager(): NodeSubscriptionManager {
  const nodeSubscriptions = new Map<string, Set<string>>();
  const sessionSubscribers = new Map<string, Set<string>>();

  const toPayloadJSON = (payload: unknown) => (payload ? JSON.stringify(payload) : null);

  const subscribe = (nodeId: string, sessionKey: string) => {
    const normalizedNodeId = nodeId.trim();
    const normalizedSessionKey = sessionKey.trim();
    if (!normalizedNodeId || !normalizedSessionKey) {
      return;
    }

    let nodeSet = nodeSubscriptions.get(normalizedNodeId);
    if (!nodeSet) {
      nodeSet = new Set<string>();
      nodeSubscriptions.set(normalizedNodeId, nodeSet);
    }
    if (nodeSet.has(normalizedSessionKey)) {
      return;
    }
    nodeSet.add(normalizedSessionKey);

    let sessionSet = sessionSubscribers.get(normalizedSessionKey);
    if (!sessionSet) {
      sessionSet = new Set<string>();
      sessionSubscribers.set(normalizedSessionKey, sessionSet);
    }
    sessionSet.add(normalizedNodeId);
  };

  const unsubscribe = (nodeId: string, sessionKey: string) => {
    const normalizedNodeId = nodeId.trim();
    const normalizedSessionKey = sessionKey.trim();
    if (!normalizedNodeId || !normalizedSessionKey) {
      return;
    }

    const nodeSet = nodeSubscriptions.get(normalizedNodeId);
    nodeSet?.delete(normalizedSessionKey);
    if (nodeSet?.size === 0) {
      nodeSubscriptions.delete(normalizedNodeId);
    }

    const sessionSet = sessionSubscribers.get(normalizedSessionKey);
    sessionSet?.delete(normalizedNodeId);
    if (sessionSet?.size === 0) {
      sessionSubscribers.delete(normalizedSessionKey);
    }
  };

  const unsubscribeAll = (nodeId: string) => {
    const normalizedNodeId = nodeId.trim();
    const nodeSet = nodeSubscriptions.get(normalizedNodeId);
    if (!nodeSet) {
      return;
    }
    for (const sessionKey of nodeSet) {
      const sessionSet = sessionSubscribers.get(sessionKey);
      sessionSet?.delete(normalizedNodeId);
      if (sessionSet?.size === 0) {
        sessionSubscribers.delete(sessionKey);
      }
    }
    nodeSubscriptions.delete(normalizedNodeId);
  };

  const sendToSession = (
    sessionKey: string,
    event: string,
    payload: unknown,
    sendEvent?: NodeSendEventFn | null,
  ) => {
    const normalizedSessionKey = sessionKey.trim();
    if (!normalizedSessionKey || !sendEvent) {
      return;
    }
    const subs = sessionSubscribers.get(normalizedSessionKey);
    if (!subs || subs.size === 0) {
      return;
    }

    const payloadJSON = toPayloadJSON(payload);
    for (const nodeId of subs) {
      sendEvent({ nodeId, event, payloadJSON });
    }
  };

  const sendToAllSubscribed = (
    event: string,
    payload: unknown,
    sendEvent?: NodeSendEventFn | null,
  ) => {
    if (!sendEvent) {
      return;
    }
    const payloadJSON = toPayloadJSON(payload);
    for (const nodeId of nodeSubscriptions.keys()) {
      sendEvent({ nodeId, event, payloadJSON });
    }
  };

  const sendToAllConnected = (
    event: string,
    payload: unknown,
    listConnected?: NodeListConnectedFn | null,
    sendEvent?: NodeSendEventFn | null,
  ) => {
    if (!sendEvent || !listConnected) {
      return;
    }
    const payloadJSON = toPayloadJSON(payload);
    for (const node of listConnected()) {
      sendEvent({ nodeId: node.nodeId, event, payloadJSON });
    }
  };

  const clear = () => {
    nodeSubscriptions.clear();
    sessionSubscribers.clear();
  };

  return {
    subscribe,
    unsubscribe,
    unsubscribeAll,
    sendToSession,
    sendToAllSubscribed,
    sendToAllConnected,
    clear,
  };
}
