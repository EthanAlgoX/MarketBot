# Modifications

This project contains modified open-source software and newly added financial
application modules. Applicable license and copyright notices are retained.
Rebranding does not make the entire codebase original work, and does not replace
those notices or rewrite Git history.

On 2026-10-13, the product-facing name, package namespace and application resource
prefix were standardized as **MarketBot**, **`@marketbot`** and
**`marketbot`**. Current documentation describes this application's financial
requirements, service boundaries and verified behavior. Earlier source comparisons,
unmodified introductions and planning archives were moved outside the product
directory to a separate research archive.

Financial changes include a private workspace bridge, strict contracts, persistent
command receipts, news subscriptions and daily archives, a financial event inbox,
manual portfolio imports, research observations and rule drafts, and simulation
controls. The integration patch records the financial-engine modifications.

See [LICENSE](LICENSE), [system architecture](docs/ARCHITECTURE.md),
[implementation record](docs/IMPLEMENTATION_LOG.md) and
[brand guidelines](docs/BRAND_GUIDELINES.md). Public release, hosted service and
production trading capability have not been established by these changes.
