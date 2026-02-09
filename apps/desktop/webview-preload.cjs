// Webview preload script — runs before the Control UI page scripts.
// Clears any stale per-device auth token from localStorage so that
// the fresh shared gateway token (passed via URL ?token=...) is used
// for WebSocket authentication instead of an expired device token.
console.log('[webview-preload] running, clearing device auth token');
try {
  const before = localStorage.getItem('marketbot.device.auth.v1');
  console.log('[webview-preload] device auth before clear:', before ? 'present' : 'absent');
  localStorage.removeItem('marketbot.device.auth.v1');
  console.log('[webview-preload] device auth cleared');
  const settings = localStorage.getItem('marketbot.control.settings.v1');
  console.log('[webview-preload] control settings:', settings);
} catch (err) {
  console.error('[webview-preload] error:', err);
}
