// Modified for marketbot on 2026-10-13; see MODIFICATIONS.md.
import type { AiRecipient } from "@marketbot/contracts";
import { AI_DATA_DISCLOSURES, AI_PRIVACY_URL } from "@marketbot/contracts";
import { Alert, AppState, Linking } from "react-native";

export const FOREGROUND_FALLBACK_MS = 400;

export function promptAiConsent(
  recipient: AiRecipient,
  privacyUrl = AI_PRIVACY_URL,
): Promise<boolean> {
  return new Promise((resolve) => {
    let settled = false;
    let dialogOpen = false;
    let waitingForPrivacyReturn = false;
    let leftForeground = false;
    let privacyAttempt = 0;
    let scheduledShow: ReturnType<typeof setTimeout> | undefined;
    let foregroundFallback: ReturnType<typeof setTimeout> | undefined;

    const cancelForegroundFallback = () => {
      if (foregroundFallback === undefined) return;
      clearTimeout(foregroundFallback);
      foregroundFallback = undefined;
    };

    const isCurrentPrivacyAttempt = (attempt: number) =>
      attempt === privacyAttempt && !settled && waitingForPrivacyReturn;

    const stillInForeground = () => !leftForeground && AppState.currentState === "active";

    const subscription = AppState.addEventListener("change", (state) => {
      if (state !== "active") {
        if (!waitingForPrivacyReturn) return;
        leftForeground = true;
        cancelForegroundFallback();
        return;
      }
      if (!waitingForPrivacyReturn || settled) return;
      cancelForegroundFallback();
      waitingForPrivacyReturn = false;
      showWhenReady();
    });

    const cleanup = () => {
      subscription.remove();
      if (scheduledShow !== undefined) clearTimeout(scheduledShow);
      cancelForegroundFallback();
    };

    const finish = (allowed: boolean) => {
      if (settled) return;
      settled = true;
      cleanup();
      resolve(allowed);
    };

    const scheduleShow = () => {
      if (settled || waitingForPrivacyReturn || scheduledShow !== undefined) return;
      scheduledShow = setTimeout(() => {
        scheduledShow = undefined;
        show();
      }, 0);
    };

    const showWhenReady = () => {
      if (settled || waitingForPrivacyReturn || dialogOpen) return;
      scheduleShow();
    };

    const show = () => {
      if (settled || waitingForPrivacyReturn || dialogOpen) return;
      dialogOpen = true;
      let privacyPolicyPressed = false;
      Alert.alert(
        `Share data with ${recipient.name}?`,
        [
          recipient.detail,
          AI_DATA_DISCLOSURES[recipient.use],
          "You can withdraw permission for new mobile actions in Account → AI data sharing.",
        ]
          .filter(Boolean)
          .join("\n\n"),
        [
          { text: "Not now", style: "cancel", onPress: () => finish(false) },
          {
            text: "Privacy policy",
            onPress: () => {
              // The button callback is the deterministic lifecycle point on both platforms.
              // RN only maps onDismiss on Android, and Android consumes a button callback
              // instead of sending a second dismissed action.
              privacyPolicyPressed = true;
              dialogOpen = false;
              cancelForegroundFallback();
              const attempt = ++privacyAttempt;
              leftForeground = AppState.currentState !== "active";
              waitingForPrivacyReturn = true;
              foregroundFallback = setTimeout(() => {
                foregroundFallback = undefined;
                if (!isCurrentPrivacyAttempt(attempt) || !stillInForeground()) return;
                waitingForPrivacyReturn = false;
                show();
              }, FOREGROUND_FALLBACK_MS);
              void Linking.openURL(privacyUrl).then(
                () => {
                  if (attempt !== privacyAttempt || settled) return;
                },
                () => {
                  if (!isCurrentPrivacyAttempt(attempt)) return;
                  cancelForegroundFallback();
                  waitingForPrivacyReturn = false;
                  showWhenReady();
                },
              );
            },
          },
          { text: "Allow", onPress: () => finish(true) },
        ],
        {
          cancelable: true,
          onDismiss: () => {
            if (privacyPolicyPressed) return;
            dialogOpen = false;
            if (settled) return;
            finish(false);
          },
        },
      );
    };

    show();
  });
}
