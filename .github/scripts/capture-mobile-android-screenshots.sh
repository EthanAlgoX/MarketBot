#!/usr/bin/env bash
# Modified for marketbot on 2026-10-13; see MODIFICATIONS.md.
set -euo pipefail

report_dir="test-report/mobile-screenshots"
run_log="${RUNNER_TEMP:?}/marketbot-mobile-screenshots.log"
android_log="${RUNNER_TEMP:?}/marketbot-mobile-android.log"
android_log_pid=""

mkdir -p "$report_dir"
exec > >(tee "$run_log") 2>&1

cleanup() {
  if [[ -n "$android_log_pid" ]]; then
    kill "$android_log_pid" 2>/dev/null || true
  fi
  cp "$android_log" "$report_dir/android.log" 2>/dev/null || true
  cp "$run_log" "$report_dir/run.log" 2>/dev/null || true
}
trap cleanup EXIT

adb install -r apps/mobile/android/app/build/outputs/apk/release/app-release.apk
adb logcat -c
adb logcat > "$android_log" &
android_log_pid=$!

timeout --signal=INT --kill-after=30s 10m pnpm test:mobile-screenshots
