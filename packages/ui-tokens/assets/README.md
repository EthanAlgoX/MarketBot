<!-- Modified for marketbot on 2026-10-13; see MODIFICATIONS.md. -->
# Application icon sources

`market-mark.svg` is the project's simple three-column market mark. `app-icon.svg`
adds the shared dark surface for opaque app exports. These are editable code assets,
with no external bitmap, font, or generator service dependency.

Run `python3 packages/ui-tokens/assets/render-icons.py` with Pillow installed to
refresh all Web, Electron, and Expo PNG/ICO exports. The script renders the SVG
rectangle geometry; it never edits an existing bitmap. React's `BrandMark` uses the
same geometry and semantic foreground color.

`MarketBot.icon` is the macOS/iOS Icon Composer source. Its foreground is the
rendered transparent `market-mark.png`; the system supplies the platform background
and mask. Xcode 26 or newer is required to compile this source. Expo and Electron
packaging reference the same path. Platform exports are development assets and do
not imply App Store, signing, or device verification.

Android has a transparent adaptive foreground and monochrome layer with launcher
safe-area padding; its opaque background stays separate. The notification image is
a white alpha mask. Android supplies its own mask; no corners are baked into these
layers. Web has SVG, ICO, touch-icon, and manifest PNG exports. Electron's macOS
development export has Dock margins; Windows and Linux use ICO and PNG.
