# 🤖 ClawFace

**Give your AI agent a face!**

A floating avatar widget for [OpenClaw](https://github.com/openclaw/openclaw) agents showing real-time emotions, actions, and visual effects.

![ClawFace Demo](https://img.shields.io/badge/status-beta-yellow) ![Platform](https://img.shields.io/badge/platform-macOS%20|%20Windows%20|%20Linux-blue) ![Python](https://img.shields.io/badge/python-3.10+-green)

---

## ✨ Features

- **9 emotions** — neutral, happy, excited, thinking, confused, tired, angry, sad, proud
- **9 actions** — idle, coding, searching, reading, loading, speaking, success, error, thinking  
- **15+ visual effects** — matrix rain, fire, confetti, radar scan, brainwave, and more

**= 1,215 unique combinations** + custom text messages!

### Two Display Modes

| 🤖 Robot Mode | 😊 Face Mode |
|---------------|--------------|
| LED-style pixel eyes | Simplified cartoon face |
| Mechanical arms with claws | Expressive eyes and mouth |
| Retro-futuristic cyberpunk | Friendly, approachable |

---

## 🚀 Quick Start

```bash
# 1. Check requirements
python3 -c "import tkinter; print('Ready!')"

# 2. Clone the repo
git clone https://github.com/mkoslacz/clawface.git
cd clawface
```

**Terminal 1 — Run ClawFace:**
```bash
python3 scripts/avatar.py --mode robot
```

**Terminal 2 — Run Demo:**
```bash
python3 scripts/avatar.py --demo
```

Watch the avatar cycle through all emotions, actions, and effects automatically! 🎉

### Manual control (without demo):
```bash
mkdir -p ~/.clawface
echo '{"emotion":"excited","action":"success","effect":"confetti","message":"Hello!"}' > ~/.clawface/avatar_state.json
```

---

## 📦 Installation as OpenClaw Skill

```bash
# Copy to skills directory
cp -r clawface /path/to/openclaw/skills/

# Install the auto-thinking hook (optional but recommended)
cp -r clawface/hooks/clawface-thinking ~/.openclaw/hooks/
openclaw hooks enable clawface-thinking
```

The hook makes ClawFace show "thinking" automatically when a turn starts — no more delay between "typing" indicator and avatar update!

---

## 🎮 Usage

### Control via State File

Write JSON to `~/.clawface/avatar_state.json`:

```json
{
  "emotion": "happy",
  "action": "coding",
  "effect": "fire",
  "message": "Building something awesome!"
}
```

### From Shell

```bash
# Happy coding with fire effect
echo '{"emotion":"happy","action":"coding","effect":"fire","message":"On fire!"}' > ~/.clawface/avatar_state.json

# Thinking with brainwave
echo '{"emotion":"thinking","action":"thinking","effect":"brainwave","message":"Hmm..."}' > ~/.clawface/avatar_state.json

# Success with confetti!
echo '{"emotion":"excited","action":"success","effect":"confetti","message":"Done!"}' > ~/.clawface/avatar_state.json
```

### From Python

```python
import json
from pathlib import Path

def set_clawface(emotion="neutral", action="idle", effect="none", message=""):
    state = {"emotion": emotion, "action": action, "effect": effect, "message": message}
    state_file = Path.home() / ".clawface" / "avatar_state.json"
    state_file.parent.mkdir(exist_ok=True)
    state_file.write_text(json.dumps(state))

# Examples
set_clawface("thinking", "reading", "matrix", "Reading files...")
set_clawface("happy", "coding", "fire", "Writing code!")
set_clawface("excited", "success", "confetti", "Done!")
```

---

## 🎭 State Reference

### Emotions
| Emotion | Color | Use when... |
|---------|-------|-------------|
| `neutral` | Gray | Default, waiting |
| `thinking` | Cyan | Processing, analyzing |
| `happy` | Green | Things going well |
| `excited` | Yellow | Big win, celebration |
| `proud` | Orange | Personal achievement |
| `confused` | Pink | Uncertain, unexpected |
| `tired` | Dark blue | Long task |
| `sad` | Blue | Failed despite trying |
| `angry` | Red | Error, frustration |

### Actions
| Action | Label | Use when... |
|--------|-------|-------------|
| `idle` | STANDBY | Waiting for user |
| `reading` | READING | Reading files/docs |
| `thinking` | THINKING | Analyzing, planning |
| `searching` | SEARCHING | Web search, grep |
| `coding` | CODING | Writing code |
| `loading` | LOADING | Running commands |
| `speaking` | OUTPUT | Sending response |
| `success` | SUCCESS! | Completed task |
| `error` | ERROR! | Something failed |

### Effects
| Effect | Description |
|--------|-------------|
| `none` | Clean, minimal |
| `matrix` | Falling code characters |
| `radar` | Scanning sweep |
| `brainwave` | Pulsing brain activity |
| `typing` | Typing animation |
| `soundwave` | Audio waveform |
| `gear` | Spinning gears |
| `fire` | Flames |
| `lightning` | Electric bolts |
| `confetti` | Celebration particles |
| `heart` | Floating hearts |
| `glitch` | Glitch effect |
| `sparkles` | Magic sparkles |
| `pulse` | Pulsing outline |
| `progressbar:XX` | Progress bar (0-100) |

---

## ⚙️ Requirements

- Python 3.10+
- tkinter

```bash
# Check if tkinter is available
python3 -c "import tkinter; print('OK')"

# Install if missing:
# macOS
brew install python-tk@3.14

# Ubuntu/Debian
sudo apt install python3-tk

# Windows
# Reinstall Python, check "tcl/tk and IDLE" during install
```

---

## 🖥️ Window Controls

- **Move**: Drag the window
- **Resize**: Drag edges/corners
- **Fullscreen**: Press `F` or double-click
- **Exit fullscreen**: Press `Escape`
- **Quit**: Press `Q`
- **Switch mode**: Click Robot/Face buttons

---

## 🔗 Links

- **OpenClaw**: [github.com/openclaw/openclaw](https://github.com/openclaw/openclaw)
- **ClawHub**: [clawhub.ai](https://www.clawhub.ai/)

---

## 📄 License

MIT

---

Made with 🦞 for the OpenClaw community
