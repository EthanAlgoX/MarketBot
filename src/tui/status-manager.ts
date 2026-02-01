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

export class StatusManager {
  private _connectionStatus = "connecting";
  private _activityStatus = "idle";
  private _listeners: (() => void)[] = [];
  private _statusTimeout: NodeJS.Timeout | null = null;
  private _isConnected = false;

  get connectionStatus() {
    return this._connectionStatus;
  }

  get activityStatus() {
    return this._activityStatus;
  }

  get isConnected() {
    return this._isConnected;
  }

  setIsConnected(connected: boolean) {
    this._isConnected = connected;
  }

  setConnectionStatus(text: string, ttlMs?: number) {
    this._connectionStatus = text;
    this.notify();

    if (this._statusTimeout) {
      clearTimeout(this._statusTimeout);
      this._statusTimeout = null;
    }

    if (ttlMs && ttlMs > 0) {
      this._statusTimeout = setTimeout(() => {
        this._connectionStatus = this._isConnected ? "connected" : "disconnected";
        this.notify();
      }, ttlMs);
    }
  }

  setActivityStatus(text: string) {
    this._activityStatus = text;
    this.notify();
  }

  subscribe(listener: () => void) {
    this._listeners.push(listener);
    return () => {
      this._listeners = this._listeners.filter((l) => l !== listener);
    };
  }

  private notify() {
    for (const listener of this._listeners) {
      listener();
    }
  }
}
