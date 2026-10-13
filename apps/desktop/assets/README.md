<!-- Modified for marketbot on 2026-10-13; see MODIFICATIONS.md. -->
# Desktop icons

The shared code sources, render command, and platform notes are in
[`packages/ui-tokens/assets`](../../../packages/ui-tokens/assets/README.md).

macOS packaging compiles `MarketBot.icon` with Xcode 26 or newer;
`icon-macos.png` is the development export with Dock margins. Windows and Linux
use `icon.ico` and `icon.png`. Application packaging is separate from configuring
the project's own signed release channel; update checks remain disabled until an
explicit HTTPS feed is configured.
