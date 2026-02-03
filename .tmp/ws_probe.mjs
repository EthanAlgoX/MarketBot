import WebSocket from "ws";

const url = "ws://127.0.0.1:18789/";

const ws = new WebSocket(url);
ws.on("open", () => {
  console.log("WS_OPEN");
  ws.close();
});
ws.on("error", (err) => {
  console.log(`WS_ERROR:${err.message}`);
});
ws.on("close", (code, reason) => {
  console.log(`WS_CLOSE:${code}:${reason.toString()}`);
});

setTimeout(() => {
  console.log("WS_TIMEOUT");
  ws.terminate();
}, 3000);
