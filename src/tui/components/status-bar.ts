/*
 * Copyright (C) 2026 MarketBot
 *
 * This file is part of MarketBot.
 *
 * MarketBot is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as
 * published by the Free Software Foundation, either version 3 of the
 * License, or (at your option) any later version.
 *
 * MarketBot is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with MarketBot.  If not, see <https://www.gnu.org/licenses/>.
 */

import { Container, Loader, Text, TUI } from "@mariozechner/pi-tui";
import { formatRelativeTime } from "../../utils/time-format.js";
import { theme } from "../theme/theme.js";
import { formatTokens } from "../tui-formatters.js";
import { SessionInfo } from "../tui-types.js";
import { buildWaitingStatusMessage, defaultWaitingPhrases } from "../tui-waiting.js";
import { StatusManager } from "../status-manager.js";

export class StatusBar extends Container {
  private header: Text;
  private subheader: Text;
  private sessionBar: Text;
  private watchlistBar: Text;
  private shortcutsBar: Text;
  private statusContainer: Container;

  private statusText: Text | null = null;
  private statusLoader: Loader | null = null;

  private busyStates = new Set(["sending", "waiting", "streaming", "running"]);
  private statusTimer: NodeJS.Timeout | null = null;
  private waitingTimer: NodeJS.Timeout | null = null;
  private waitingPhrase: string | null = null;
  private waitingTick = 0;
  private statusStartedAt: number | null = null;
  private lastActivityStatus = "idle";

  constructor(
    private tui: TUI,
    private statusManager: StatusManager,
  ) {
    super();

    this.header = new Text("", 0, 0);
    this.subheader = new Text("", 0, 0);
    this.sessionBar = new Text("", 0, 0);
    this.watchlistBar = new Text("", 0, 0);
    this.statusContainer = new Container();
    this.shortcutsBar = new Text("", 0, 0);

    this.addChild(this.header);
    this.addChild(this.subheader);
    this.addChild(this.sessionBar);
    this.addChild(this.watchlistBar);
    this.addChild(this.statusContainer);
    this.addChild(this.shortcutsBar);

    this.initStatusSubscription();
    this.updateShortcutsBar();
  }

  private initStatusSubscription() {
    this.statusManager.subscribe(() => {
      this.renderStatus();
    });
  }

  updateHeader(url: string) {
    this.header.setText(`${theme.header("MarketBot TUI")} ${theme.dim("|")} ${theme.dim(url)}`);
  }

  updateSessionBar(
    sessionInfo: SessionInfo,
    currentSessionKey: string,
    currentAgentId: string,
    formatSessionKey: (key: string) => string,
    formatAgentLabel: (id: string) => string,
  ) {
    const sessionKeyLabel = formatSessionKey(currentSessionKey);
    const sessionLabel = sessionInfo.displayName
      ? `${sessionKeyLabel} (${sessionInfo.displayName})`
      : sessionKeyLabel;
    const agentLabel = formatAgentLabel(currentAgentId);
    const modelLabel = sessionInfo.model
      ? sessionInfo.modelProvider
        ? `${sessionInfo.modelProvider}/${sessionInfo.model}`
        : sessionInfo.model
      : "unknown";
    const tokens = formatTokens(sessionInfo.totalTokens ?? null, sessionInfo.contextTokens ?? null);
    const think = sessionInfo.thinkingLevel ?? "off";
    const verbose = sessionInfo.verboseLevel ?? "off";
    const reasoning = sessionInfo.reasoningLevel ?? "off";
    const usage = sessionInfo.responseUsage ?? "off";
    const reasoningLabel =
      reasoning === "on" ? "reasoning" : reasoning === "stream" ? "reasoning:stream" : null;
    const footerParts = [
      `agent ${agentLabel}`,
      `session ${sessionLabel}`,
      modelLabel,
      think !== "off" ? `think ${think}` : null,
      verbose !== "off" ? `verbose ${verbose}` : null,
      reasoningLabel,
      usage !== "off" ? `usage ${usage}` : null,
      tokens,
    ].filter(Boolean);
    this.sessionBar.setText(theme.dim(footerParts.join(" | ")));

    // Also update subheader to reflect updated time
    this.renderStatus(sessionInfo.updatedAt ?? undefined);
  }

  updateWatchlistBar(watchlist: string[]) {
    if (watchlist.length === 0) {
      this.watchlistBar.setText(
        `${theme.marketInfo("Watchlist")} ${theme.dim("|")} ${theme.dim("empty (use /watch <symbol>)")}`,
      );
      return;
    }
    const symbolList = watchlist.map((symbol) => theme.highlight(symbol)).join(", ");
    this.watchlistBar.setText(
      `${theme.marketInfo(`Watchlist (${watchlist.length})`)} ${theme.dim("|")} ${symbolList}`,
    );
  }

  updateShortcutsBar() {
    this.shortcutsBar.setText(
      theme.dim(
        "Keys: Alt+Enter commands | Shift+Tab help | Ctrl+L model | Ctrl+G agent | Ctrl+P session | Ctrl+O tools | Ctrl+T thinking | Ctrl+C exit",
      ),
    );
  }

  private formatConnectionLabel() {
    const status = this.statusManager.connectionStatus;
    const lower = status.toLowerCase();
    if (lower.includes("disconnected") || lower.includes("error")) {
      return theme.error(`o ${status}`);
    }
    if (lower.includes("connecting") || lower.includes("reconnecting") || lower.includes("gap")) {
      return theme.warning(`o ${status}`);
    }
    if (lower.includes("connected")) {
      return theme.success(`o ${status}`);
    }
    return theme.neutral(`o ${status}`);
  }

  private formatActivityLabel() {
    const normalized = this.statusManager.activityStatus || "idle";
    if (normalized === "idle") {
      return theme.dim(normalized);
    }
    if (normalized === "error") {
      return theme.error(normalized);
    }
    if (normalized === "aborted") {
      return theme.warning(normalized);
    }
    if (normalized === "waiting") {
      return theme.neutral(normalized);
    }
    if (normalized === "streaming") {
      return theme.accent(normalized);
    }
    if (normalized === "sending") {
      return theme.accentSoft(normalized);
    }
    if (normalized === "running") {
      return theme.marketInfo(normalized);
    }
    return theme.accentSoft(normalized);
  }

  private renderStatus(updatedAt?: number) {
    const activityStatus = this.statusManager.activityStatus;
    const connectionStatus = this.statusManager.connectionStatus;
    const isBusy = this.busyStates.has(activityStatus);

    if (isBusy) {
      if (!this.statusStartedAt || this.lastActivityStatus !== activityStatus) {
        this.statusStartedAt = Date.now();
      }
      this.ensureStatusLoader();
      if (activityStatus === "waiting") {
        this.stopStatusTimer();
        this.startWaitingTimer();
      } else {
        this.stopWaitingTimer();
        this.startStatusTimer();
      }
      this.updateBusyStatusMessage();
    } else {
      this.statusStartedAt = null;
      this.stopStatusTimer();
      this.stopWaitingTimer();
      this.statusLoader?.stop();
      this.statusLoader = null;
      this.ensureStatusText();
      const text = activityStatus ? `${connectionStatus} | ${activityStatus}` : connectionStatus;
      this.statusText?.setText(theme.dim(text));
    }

    this.lastActivityStatus = activityStatus;

    // Update subheader text
    const updatedLabel = typeof updatedAt === "number" ? formatRelativeTime(updatedAt) : "n/a";
    this.subheader.setText(
      `${this.formatConnectionLabel()} ${theme.dim("|")} ${theme.dim("activity")} ${this.formatActivityLabel()} ${theme.dim("|")} ${theme.dim("updated")} ${theme.dim(updatedLabel)}`,
    );
  }

  private ensureStatusText() {
    if (this.statusText) {
      return;
    }
    this.statusContainer.clear();
    this.statusLoader?.stop();
    this.statusLoader = null;
    this.statusText = new Text("", 1, 0);
    this.statusContainer.addChild(this.statusText);
  }

  private ensureStatusLoader() {
    if (this.statusLoader) {
      return;
    }
    this.statusContainer.clear();
    this.statusText = null;
    this.statusLoader = new Loader(
      this.tui,
      (spinner) => theme.accent(spinner),
      (text) => theme.bold(theme.accentSoft(text)),
      "",
    );
    this.statusContainer.addChild(this.statusLoader);
  }

  private formatElapsed(startMs: number) {
    const totalSeconds = Math.max(0, Math.floor((Date.now() - startMs) / 1000));
    if (totalSeconds < 60) {
      return `${totalSeconds}s`;
    }
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}m ${seconds}s`;
  }

  private updateBusyStatusMessage() {
    const activityStatus = this.statusManager.activityStatus;
    const connectionStatus = this.statusManager.connectionStatus;

    if (!this.statusLoader || !this.statusStartedAt) {
      return;
    }
    const elapsed = this.formatElapsed(this.statusStartedAt);

    if (activityStatus === "waiting") {
      this.waitingTick++;
      this.statusLoader.setMessage(
        buildWaitingStatusMessage({
          theme,
          tick: this.waitingTick,
          elapsed,
          connectionStatus,
          phrases: this.waitingPhrase ? [this.waitingPhrase] : undefined,
        }),
      );
      return;
    }

    this.statusLoader.setMessage(`${activityStatus} | ${elapsed} | ${connectionStatus}`);
  }

  private startStatusTimer() {
    if (this.statusTimer) {
      return;
    }
    this.statusTimer = setInterval(() => {
      const activityStatus = this.statusManager.activityStatus;
      if (!this.busyStates.has(activityStatus)) {
        return;
      }
      this.updateBusyStatusMessage();
    }, 1000);
  }

  private stopStatusTimer() {
    if (!this.statusTimer) {
      return;
    }
    clearInterval(this.statusTimer);
    this.statusTimer = null;
  }

  private startWaitingTimer() {
    if (this.waitingTimer) {
      return;
    }

    // Pick a phrase once per waiting session.
    if (!this.waitingPhrase) {
      const idx = Math.floor(Math.random() * defaultWaitingPhrases.length);
      this.waitingPhrase = defaultWaitingPhrases[idx] ?? defaultWaitingPhrases[0] ?? "waiting";
    }

    this.waitingTick = 0;

    this.waitingTimer = setInterval(() => {
      const activityStatus = this.statusManager.activityStatus;
      if (activityStatus !== "waiting") {
        return;
      }
      this.updateBusyStatusMessage();
    }, 120);
  }

  private stopWaitingTimer() {
    if (!this.waitingTimer) {
      return;
    }
    clearInterval(this.waitingTimer);
    this.waitingTimer = null;
    this.waitingPhrase = null;
  }
}
