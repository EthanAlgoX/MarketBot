<!-- Modified for marketbot on 2026-10-13; see MODIFICATIONS.md. -->
# Set up MarketBot with a coding agent

Use this prompt from a local source checkout. The project has no verified public
installer, hosted service, container registry or downloadable app release yet.
The current supported development path is documented in
[local development](docs/LOCAL_DEVELOPMENT.md).

```text
Set up this MarketBot checkout and leave the local financial workbench running.

Read AGENTS.md, README.md and docs/LOCAL_DEVELOPMENT.md before making changes.
Preserve local changes, existing environment files and databases. Do not commit,
tag, push, register real trading accounts or place trades as part of setup.

Never print or log secret values. Inspect existing configuration by key names only;
generate required development credentials through the project setup tool and keep
them in the ignored .local directory. Never copy a user's old financial database
or credentials into the development environment.

Use the Node and pnpm versions declared in package.json. Verify Python, uv and the
PostgreSQL command-line tools. Do not stop unrelated processes to free ports.
Use the project lifecycle scripts to start, stop and identify owned processes.

Run the documented financial-engine bootstrap and local prepare, install-minimal,
db-start, migrate and start steps. The financial engine uses its pinned version
and exported integration patch; do not substitute an unverified moving branch.

Verify the web, API and financial health endpoints without displaying credentials.
Leave the development database available for the user to register their own first
administrator. Use a separate verification database and fake accounts when a UI
test needs authenticated data.

Keep model research and stock-market simulation closed until their real configuration
and acceptance checks pass. Installing SDKs does not prove that a model or market
data provider works. The initial verified simulation scope is BTC spot daily bars.

If a model or device needs user credentials or sign-in, prepare the configuration
and report what is missing without requesting secret values in chat. For public
deployment, native device delivery or a custom strategy, follow the relevant task
and acceptance requirements rather than treating local setup as release approval.

Report the app URL, health results, enabled capabilities, remaining acceptance
limits and the documented stop/restart commands. Do not run the local Electron
Playwright suite; it opens windows and steals focus on macOS.
```

Desktop packaging, mobile signing and public deployment remain separate release
tasks. No new publishing destination is implied by the product name.
