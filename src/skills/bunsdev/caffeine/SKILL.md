---
name: caffeine
description: Prevent the computer screen and system from falling asleep on macOS or Windows. Use when the user wants to keep their display awake, disable sleep, or run a long task without interruption.
---

# Caffeine

Keeps your computer awake by preventing display and system sleep.

## Quick Start

### macOS

```bash
caffeinate -d
```

### Windows (PowerShell)

```powershell
# Keep display awake until Ctrl+C
while ($true) {
  $wsh = New-Object -ComObject WScript.Shell
  $wsh.SendKeys('{SCROLLLOCK}{SCROLLLOCK}')
  Start-Sleep -Seconds 60
}
```

---

## macOS

Uses the built-in `caffeinate` command (no installation needed).

### Options

| Command | Effect |
|---------|--------|
| `caffeinate` | Prevent sleep until terminated |
| `caffeinate -d` | Prevent **display** from sleeping |
| `caffeinate -i` | Prevent **idle** sleep |
| `caffeinate -s` | Prevent **system** sleep (AC power only) |
| `caffeinate -t 3600` | Prevent sleep for 1 hour (seconds) |
| `caffeinate -d -t 1800` | Keep display on for 30 minutes |

### Examples

Keep display on for 2 hours:

```bash
caffeinate -d -t 7200
```

Keep awake while a command runs:

```bash
caffeinate -i -- long-running-command
```

Run in background:

```bash
caffeinate -d &
# To stop later:
pkill caffeinate
```

Check if running:

```bash
pgrep -l caffeinate
```

---

## Windows

### Option 1: PowerShell (no install)

Prevent sleep by simulating activity (Ctrl+C to stop):

```powershell
while ($true) {
  $wsh = New-Object -ComObject WScript.Shell
  $wsh.SendKeys('{SCROLLLOCK}{SCROLLLOCK}')
  Start-Sleep -Seconds 60
}
```

### Option 2: powercfg (change power settings)

Disable sleep temporarily:

```powershell
# Disable sleep on AC power
powercfg /change standby-timeout-ac 0
powercfg /change monitor-timeout-ac 0

# Re-enable later (e.g., 30 minutes)
powercfg /change standby-timeout-ac 30
powercfg /change monitor-timeout-ac 15
```

### Option 3: Presentation mode

```powershell
# Enable presentation mode (disables sleep + notifications)
presentationsettings /start

# Disable when done
presentationsettings /stop
```

### Option 4: One-liner with .NET

```powershell
# Prevent sleep for duration of script
Add-Type -AssemblyName System.Windows.Forms
while ($true) {
  [System.Windows.Forms.Cursor]::Position = [System.Windows.Forms.Cursor]::Position
  Start-Sleep -Seconds 60
}
```

---

## Notes

- **macOS**: `caffeinate` is built-in; process must stay running
- **Windows**: PowerShell methods simulate activity; `powercfg` changes system settings
- Press **Ctrl+C** to stop any running script
