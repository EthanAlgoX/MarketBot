#!/usr/bin/env node
/**
 * Escalation Check Script
 * Checks if a safety alert has gone unacknowledged for too long.
 * 
 * Returns JSON with action needed:
 *   { "action": "none" } - No pending alerts or already acknowledged
 *   { "action": "escalate", "alert": "...", "minutesPending": N, "contact": "..." } - Need to email
 *   { "action": "waiting", "alert": "...", "minutesRemaining": N } - Alert pending but not yet 15 min
 */

const fs = require('fs');
const path = require('path');

const STATE_FILE = path.join(__dirname, 'safety-state.json');
const ESCALATION_THRESHOLD_MS = 15 * 60 * 1000; // 15 minutes
const EMERGENCY_CONTACT = 'ashuppal@gmail.com';
const EMERGENCY_CONTACT_NAME = 'Ash';

function run() {
  let state;
  try {
    state = JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));
  } catch (e) {
    console.log(JSON.stringify({ action: 'none', reason: 'no state file' }));
    return;
  }

  // No pending alert
  if (!state.pendingAlert || !state.alertSentAt) {
    console.log(JSON.stringify({ action: 'none', reason: 'no pending alert' }));
    return;
  }

  // Already acknowledged
  if (state.acknowledgedAt) {
    console.log(JSON.stringify({ action: 'none', reason: 'already acknowledged' }));
    return;
  }

  const alertTime = new Date(state.alertSentAt).getTime();
  const now = Date.now();
  const elapsed = now - alertTime;
  const elapsedMinutes = Math.round(elapsed / 60000);

  if (elapsed >= ESCALATION_THRESHOLD_MS) {
    // Time to escalate!
    console.log(JSON.stringify({
      action: 'escalate',
      alert: state.pendingAlert,
      alertSentAt: state.alertSentAt,
      minutesPending: elapsedMinutes,
      contact: EMERGENCY_CONTACT,
      contactName: EMERGENCY_CONTACT_NAME
    }));
  } else {
    // Still waiting
    const remaining = Math.ceil((ESCALATION_THRESHOLD_MS - elapsed) / 60000);
    console.log(JSON.stringify({
      action: 'waiting',
      alert: state.pendingAlert,
      minutesPending: elapsedMinutes,
      minutesRemaining: remaining
    }));
  }
}

run();
