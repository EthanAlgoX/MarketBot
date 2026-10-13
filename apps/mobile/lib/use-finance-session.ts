import * as SecureStore from "expo-secure-store";
import { useEffect, useRef, useState } from "react";
import { captureApiRequestContext, currentApiBase, rpc, subscribeApiBase } from "./api";
import type { FinanceSession } from "./finance-session-fence";
import { captureFinanceSession } from "./finance-session-fence";
import { useI18n } from "./i18n";
import { currentSessionGeneration, subscribeSessionGeneration } from "./session";

export function useFinanceSession(setError: (message: string | null) => void) {
  const { t } = useI18n();
  const message = useRef({ setError, t });
  message.current = { setError, t };
  const [session, setSession] = useState<FinanceSession | null>(null);
  useEffect(() => {
    let alive = true;
    const generation = currentSessionGeneration();
    const endpoint = currentApiBase();
    const current = () =>
      alive && generation === currentSessionGeneration() && endpoint === currentApiBase();
    const invalidate = () => {
      if (!current() && alive) {
        setSession(null);
        message.current.setError(message.current.t("登录会话已变化，请重新打开金融页面。"));
      }
    };
    const unsubscribe = subscribeSessionGeneration(invalidate);
    const unsubscribeEndpoint = subscribeApiBase(invalidate);
    void (async () => {
      const captured = await captureFinanceSession({
        captureContext: captureApiRequestContext,
        alive: () => alive,
        currentEndpoint: currentApiBase,
        currentGeneration: currentSessionGeneration,
        request: (procedure, input, captured) =>
          rpc(procedure, input, { requestContext: captured }),
        get: SecureStore.getItemAsync,
        set: SecureStore.setItemAsync,
        delete: SecureStore.deleteItemAsync,
      });
      if (current()) setSession(captured);
    })().catch(() => {
      if (current())
        message.current.setError(message.current.t("无法确认当前金融会话，请重新打开金融页面。"));
    });
    return () => {
      alive = false;
      unsubscribe();
      unsubscribeEndpoint();
    };
    // The owner cannot be rebound in place; navigation must mount a new financial surface.
  }, []);
  return session;
}

/** Restores only this owner's intent. A corrupt or unavailable store keeps writes disabled. */
export function useFinanceIntent<T>(
  session: FinanceSession | null,
  kind: string,
  schema: { parse: (value: unknown) => T },
  setPending: (value: T | null) => void,
  setError: (message: string | null) => void,
  failureMessage: string,
) {
  const [storageKey, setStorageKey] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    setStorageKey(null);
    setPending(null);
    if (!session?.isCurrent()) return;
    const key = session.key(kind);
    void session
      .restore(key)
      .then((raw) => {
        const restored = raw ? schema.parse(JSON.parse(raw)) : null;
        if (!cancelled && session.isCurrent()) {
          setPending(restored);
          setStorageKey(key);
        }
      })
      .catch(() => {
        if (!cancelled && session.isCurrent()) setError(failureMessage);
      });
    return () => {
      cancelled = true;
    };
  }, [session, kind, schema, setPending, setError, failureMessage]);
  return session?.isCurrent() ? storageKey : null;
}
