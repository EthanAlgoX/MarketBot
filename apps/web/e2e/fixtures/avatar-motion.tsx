// Modified for marketbot on 2026-10-13; see MODIFICATIONS.md.
import { BotAvatar } from "@marketbot/ui-web";
import { createRoot } from "react-dom/client";

createRoot(document.getElementById("root")!).render(
  <BotAvatar color="#D9508A" identity="reduced-motion" size={120} status="running" />,
);
