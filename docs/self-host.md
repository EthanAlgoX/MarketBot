<!-- Modified for marketbot on 2026-10-13; see MODIFICATIONS.md. -->
# Self-hosting MarketBot

The verified deployment path is the local source setup in
[LOCAL_DEVELOPMENT.md](LOCAL_DEVELOPMENT.md). MarketBot currently has no
published installer, container images, hosted endpoint or signed desktop/mobile
release. Do not use an unrelated project's published release as a substitute for
this application's financial integration.

## Local source setup

Run the pinned financial-engine bootstrap, then prepare, install dependencies,
start PostgreSQL, migrate and start services with the project scripts. See the
local guide for the exact commands. The current development addresses are:

| Service | Address | Role |
| --- | --- | --- |
| Web | `http://127.0.0.1:5181` | Browser UI; Electron may connect to the same instance |
| API | `http://127.0.0.1:3111` | Login and authenticated business RPC |
| Financial service | `http://127.0.0.1:8111` | Private integration endpoint and single financial executor |
| PostgreSQL | Loopback port `55433` | Assistant records and archives |

Development credentials and databases are kept under the ignored `.local`
directory. Register the first administrator yourself. Never import an existing
personal database as a disposable test fixture. Verification creates isolated
accounts and databases; fake verification holdings are not user holdings.

The default local environment enables verified BTC daily simulation, leaves
stock-market simulation and model research disabled, and uses the offline agent
runtime. The complete financial SDK environment has passed import checks, but
that does not verify model credentials, stock data or generated research.

## Service and process ownership

Use `scripts/finance-dev.sh` for lifecycle operations. It verifies process
ownership before stopping a service, refuses unrelated port conflicts and waits
for owned process groups to terminate. Do not kill unrelated processes or start
a second financial executor on the same workspace.

The assistant API and Worker share PostgreSQL. The financial service preserves
its separate control database and private workspace SQLite files. The financial
service owns ledger writes, durable command receipts and simulation advancement;
notification retries are separate from trading or research execution.

Closing a web or mobile client does not stop background services. Sleep,
shutdown, lost network or a stopped hosting machine can interrupt them. A
24-hour deployment requires a continuously available host and the documented
72-hour acceptance run; the desktop shell alone is not that deployment.

## Authentication and private endpoints

Only the authenticated assistant API receives browser requests to financial
functions. Internal service credentials, deployment issuer and subject mapping
are server-side. Do not expose the financial integration endpoint publicly,
allow client owner/path overrides or share a browser cookie as the service
credential. Missing bindings or databases must remain errors rather than empty
replacement accounts.

A remote deployment must use HTTPS with correct public origins and callback
addresses. Keep databases and financial workspace storage on private interfaces.
Use strong random credentials, retain `.env` and `.local` exclusions, and never
put signing identities, provider keys, holdings or production snapshots in Git.
The operator must provide real support and private vulnerability-reporting
channels; see [SECURITY.md](../SECURITY.md).

## Optional models and integrations

Model, voice, memory, external computer and app providers are optional. Configure
them through shared connections and adapters. A local connection can use an
OpenAI-compatible endpoint, but the connection must still pass capability,
privacy and authorization checks. Do not assume model or integration
subscriptions give this deployment usable credentials.

The financial research engine has its own budget and actual usage accounting.
Keep its gate closed until real inputs, outputs, limits and source operations
are validated. Generated observations or rule drafts do not automatically
start a simulation. This deployment does not connect real order execution.

## Optional computer runtime

For a local Docker computer, run `infra/compose/restrict-computer-egress.sh`
before enabling `SANDBOX_COMPUTER_EGRESS=restricted`. The script applies to
Linux hosts with iptables support.

The local financial workbench uses `SANDBOX_PROVIDER=none`. Enabling an assistant
computer is a separate configuration step and can grant host access or provision
remote machines. Read [computer-runtime.md](computer-runtime.md),
[self-host-sandbox-providers.md](self-host-sandbox-providers.md) and
[self-host/cloud-agents.md](self-host/cloud-agents.md) before enabling it.

For Docker computers, the lifecycle supervisor owns the Docker socket; the API
does not receive unrestricted socket access. Use non-root workspace users,
per-computer networks, protected screen/control tokens and resource limits.
The `MARKETBOT_COMPUTER_MEMORY`, `MARKETBOT_COMPUTER_CPUS` and
`MARKETBOT_COMPUTER_PIDS_LIMIT` settings must match the selected runtime.
A trusted host or destination is not isolated from data deliberately sent to it.
Do not run the local Electron Playwright suite as routine verification.

## Backups and restore

Use the verified project backup tool rather than copying live database files.
It stops owned writers, snapshots PostgreSQL and the financial databases,
restores into a new random target, checks counts, event cursors and SQLite
integrity, removes verification targets, and resumes owned services when
requested. See [LOCAL_DEVELOPMENT.md](LOCAL_DEVELOPMENT.md) for commands and
[LOCAL_RUNTIME_VERIFICATION.md](LOCAL_RUNTIME_VERIFICATION.md) for evidence.

Protect backups with restricted permissions and encrypted off-host storage.
Recovery must detect a restored financial event high-water mark behind the
assistant cursor and freeze consumption until reconciled; it must not infer
fills from current positions. Restore and migration do not automatically
resend interrupted research or upgrade historical Float ledgers.

## Packaging and release

The repository includes container and native build tooling, but financial
packaging and public release remain separate acceptance tasks. A release
operator must choose their own real registry, repository, domain, store accounts,
signing configuration, privacy policy and private secrets. No default public
image address is established by the product name.

Validate all enabled capabilities, auth callbacks, migration, backup/restore,
real device delivery and the continuous-run requirement before distribution.
For native build requirements, see [desktop-release.md](desktop-release.md)
and [mobile-release.md](mobile-release.md). The current implementation status
and remaining limits are in [IMPLEMENTATION_LOG.md](IMPLEMENTATION_LOG.md).
