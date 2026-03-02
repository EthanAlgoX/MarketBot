---
summary: "Architecture map of the Gateway, plugin platform, channel adapters, and message pipeline"
---
# Gateway architecture

Last updated: 2026-03-02

## Overview

MarketBot uses a plugin driven modular monolith:

- A single Gateway process owns runtime lifecycle, transport servers, and orchestration.
- Channels, providers, tools, and custom commands are registered through the plugin registry.
- Inbound messages pass through one unified reply pipeline, then outbound delivery delegates to channel adapters.

Related docs:

- [Gateway runbook](/gateway)
- [Gateway protocol](/gateway/protocol)
- [Plugin system](/plugin)
- [Heartbeat](/gateway/heartbeat)

## Runtime topology

Primary bootstrap happens in `startGatewayServer`:

1. Read and validate config snapshot, apply migration when needed.
2. Load plugins and collect gateway methods and handlers.
3. Build runtime state (HTTP, WS, subscriptions, dedupe, run buffers).
4. Build channel manager and start channel account runtimes.
5. Start side services (cron, heartbeat, discovery, browser control, hooks).
6. Attach hot reload handlers and close lifecycle handlers.

Main entrypoints in code:

- `src/gateway/server.impl.ts`
- `src/gateway/server-plugins.ts`
- `src/gateway/server-channels.ts`

## Message flow

Inbound to outbound flow:

1. Channel monitor normalizes incoming message into `MsgContext`.
2. `dispatchInboundMessage` finalizes context and calls config driven reply dispatch.
3. Reply dispatch applies dedupe, hooks, routing, and TTS behavior.
4. `getReplyFromConfig` runs context preparation, media and link understanding, directives, inline actions, and the prepared run.
5. Final `ReplyPayload[]` is delivered by the unified outbound layer.
6. Outbound layer lazily loads channel outbound adapters and sends text or media with chunking rules.

Main entrypoints in code:

- `src/auto-reply/dispatch.ts`
- `src/auto-reply/reply/dispatch-from-config.ts`
- `src/auto-reply/reply/get-reply.ts`
- `src/infra/outbound/deliver.ts`

## Plugin and channel model

The plugin loader discovers plugins from config paths, workspace, global, and bundled locations. It validates manifests, config schema, and registration outputs.

The plugin registry is the central contract surface for:

- tools
- hooks
- typed hooks
- channels
- providers
- gateway methods
- HTTP handlers and routes
- CLI registrars
- plugin commands

Channel plugins implement a broad adapter contract including config, security, outbound, status, gateway lifecycle, commands, threading, and heartbeat.

Main entrypoints in code:

- `src/plugins/discovery.ts`
- `src/plugins/loader.ts`
- `src/plugins/registry.ts`
- `src/channels/plugins/types.plugin.ts`
- `extensions/*/src/channel.ts`

## Routing and session identity

Agent routing resolves by binding specificity and then fallback:

1. peer
2. guild
3. team
4. account
5. channel wildcard
6. default agent

Session keys are derived from agent, channel, account, peer kind, peer id, and DM scope. Optional identity links can collapse equivalent peers across ids.

Main entrypoints in code:

- `src/routing/resolve-route.ts`
- `src/routing/session-key.ts`
- `src/routing/bindings.ts`

## Concurrency model

Execution uses lane based in process queues:

- per lane queue with configurable concurrency
- session lane and global lane composition for embedded agent runs
- heartbeat scheduler with per agent intervals and active hour checks

Main entrypoints in code:

- `src/process/command-queue.ts`
- `src/agents/pi-embedded-runner/run.ts`
- `src/infra/heartbeat-runner.ts`

## Strengths and pressure points

Strengths:

- Strong extension model through plugin contracts.
- Unified reply and outbound pipelines across channels.
- Clear routing and session identity primitives for multi agent and multi channel operation.

Pressure points:

- Large orchestrator files increase change risk during feature work.
- Broad plugin runtime surface increases long term compatibility burden.
- Reply dispatch pipeline carries many behaviors in one module.

## Suggested refactor sequence

1. Split reply dispatch into staged modules without changing external behavior.
2. Separate plugin runtime surface into stable and experimental namespaces.
3. Break gateway startup into dedicated bootstrap modules for config, plugins, channels, and side services.
4. Add scenario tests for cross channel routing plus TTS plus streaming combinations.
