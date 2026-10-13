<!-- Modified for marketbot on 2026-10-13; see MODIFICATIONS.md. -->
# MarketBot product direction

MarketBot is a personal financial workbench for people who follow stocks and
crypto. It helps the user see relevant changes, inspect evidence, research an
asset, monitor a simulation and review what was known when a decision was made.
Useful results belong in durable records that can be revisited across devices.

## Financial workflows have a home

News and author content enter versioned subscriptions, recommendations and daily
archives. Research produces inspectable reports and observations. Strategies
have explicit configurations, frozen versions, separate runs and financial
records. Chat assists these workflows; a reply does not silently change a ledger
or start a strategy.

The product distinguishes a news item, a model opinion, a rule decision, an order
and a fill. It shows the source and relevant time, preserves uncertainty and
missing data, and does not turn model confidence into trading win probability.
Historical snapshots remain immutable; feedback and corrections are appended.

## One product across devices

Web and Electron share the web application. Expo mobile uses the same server
contracts and durable records with native navigation, storage, permissions and
controls. Closing a client does not stop the server, while sleep or shutdown of
the machine that hosts the server can interrupt background work.

Shared behavior lives in packages. Platform-specific code is reserved for real
native differences. A feature is enabled only where its backend capability and
device requirements are met; unsupported states are explicit.

## Ownership and boundaries

The operator controls deployment and selects optional model, data, computer,
voice and integration providers. No hosted vendor is required for the core
application. Providers use shared contracts, adapters and deterministic offline
conformance tests. State must be inspectable, recoverable and portable.

Spaces and financial workspaces are authorization boundaries. Credentials,
private files, conversations, memory and holdings are not shared implicitly.
The financial engine owns the sole financial ledger and simulation executor;
the assistant owns subscriptions, archives, event receipt and notification
delivery. Notification retries never advance a strategy again.

Commands have stable identities and results. An unknown response is recovered
by querying the original command. Logout or a server change invalidates pending
client actions. Secrets, authentication, host access, sandbox boundaries and
external integrations are security-sensitive.

## Calm interfaces, verifiable behavior

Show the content and controls needed for the next decision, with advanced details
available when relevant. Frontends express intent and render state; backends own
authorization, validation, orchestration, budgets, retries and recovery. Tests
remain deterministic and offline by default, and live acceptance uses isolated
accounts and clearly identified data.

The current release scope is simulation. Real model research, stock data,
the user's own strategy, native device delivery and 72 hours of continuous
operation need their documented acceptance checks. Real account synchronization
and order execution require a separately specified financial execution model.

## Maintaining direction

This file records current product direction. The implementation plan defines
scope and acceptance; the implementation log records evidence and remaining
limits. Brand changes do not change software provenance, licensing, measured
capabilities or release status. Do not claim that reused software is entirely
original work.
