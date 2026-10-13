<!-- Modified for marketbot on 2026-10-13; see MODIFICATIONS.md. -->
# Restricted-network setup

The current MarketBot development setup runs from a local source checkout.
There is no verified public installer or image registry. Follow
[LOCAL_DEVELOPMENT.md](LOCAL_DEVELOPMENT.md) first; choose only dependency
mirrors or registries controlled and verified by the deployment operator.

## Source and dependency access

Preserve the pinned financial-engine commit and integration patch when moving
source between machines. An offline copy must include the documented sources,
lockfiles, patch, manifest and required dependency caches. Do not replace the
financial engine with a moving branch to bypass a network failure.

The Node runtime must satisfy `package.json`, and pnpm must use the declared
version. Python dependencies use the exported locks for the selected runtime.
Use the project's offline/replay verification before treating a transferred
checkout as reproducible. Blocked dependency access is a setup limitation,
not evidence that model research or market sources are available.

## Digest-verified Hub mirror startup

If the operator uses Docker tooling, mirror the chosen images through a trusted
registry and record their verified digests. Use explicit digest-qualified image
references, pull them deliberately, inspect the actual digest, and start with
`--pull never` after verification. Do not assume a mirror's mutable tag is equal
to the source image. Retain the Compose configuration used for deployment.

MarketBot does not supply a published image destination. The operator must
build the application and verify that their packaging includes both assistant
and financial services before publishing their own images. Container access
alone does not prove the financial workflows or native clients work.

## Private endpoints and proxies

Do not weaken HTTPS, certificate verification, credential handling or workspace
authorization to get around a restricted network. Keep internal financial APIs
and databases private. If a source or model is unreachable, show its actual
failure and leave dependent capabilities closed rather than substituting empty
results. Never print proxy credentials or provider tokens in diagnostic logs.

See [self-host.md](self-host.md), [SECURITY.md](../SECURITY.md) and
[LOCAL_RUNTIME_VERIFICATION.md](LOCAL_RUNTIME_VERIFICATION.md).
