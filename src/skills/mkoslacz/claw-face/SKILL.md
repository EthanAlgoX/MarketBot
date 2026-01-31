---
name: clawface
description: Floating avatar widget for AI agents showing emotions, actions, and visual effects. Give your OpenClaw a face! Use when the user wants visual feedback, a floating status window, or to see agent emotions while it works. Triggers on "show avatar", "uruchom avatara", "pokaż avatara", "agent face", "visual feedback".
---

# 🤖 ClawFace

**Give your OpenClaw a face!**

---

Got a dedicated machine running OpenClaw with a monitor? Tired of staring at logs all day? 

**Give your agent a personality!**

- **9 emotions** — from happy to angry, thinking to proud
- **9 actions** — coding, searching, reading, speaking...
- **15 visual effects** — matrix rain, fire, confetti, radar scan...

That's **1,215 unique combinations** + custom messages from your agent!

Perfect for:
- 💻 Laptop setups where you want to SEE your agent working
- 🖥️ Dedicated OpenClaw machines with a monitor
- 🎮 Making your AI assistant feel alive
- 📺 Impressing your friends/coworkers

> ⚠️ **Note:** Only tested on macOS. Should work on Windows/Linux but YMMV.

---

## 🚀 Quick Test (try it now!)

```bash
# 1. Check if you have Python + tkinter:
python3 -c "import tkinter; print('Ready!')"
```

**Terminal 1 — Run ClawFace:**
```bash
python3 SKILL_PATH/scripts/avatar.py --mode robot
```

**Terminal 2 — Run Demo:**
```bash
python3 SKILL_PATH/scripts/avatar.py --demo
```

Watch the avatar cycle through all emotions, actions, and effects automatically! 🎉

### Manual control:
```bash
echo '{"emotion":"excited","action":"success","effect":"confetti","message":"It works!"}' > ~/.clawface/avatar_state.json
```

---

## ⚠️ Requirements

**Python 3.10+ with tkinter:**
```bash
# Check:
python3 -c "import tkinter; print('OK')"

# Install if missing:
# macOS:   brew install python-tk@3.14
# Ubuntu:  sudo apt install python3-tk
# Windows: reinstall Python, check "tcl/tk and IDLE" during install
```

---

## 📦 Full Installation

### 1. Install the auto-thinking hook (recommended):
```bash
cp -r SKILL_PATH/hooks/clawface-thinking ~/.openclaw/hooks/
openclaw hooks enable clawface-thinking
```
This makes the avatar show "thinking" automatically when a turn starts — no delay!

### 2. Launch the avatar:
```bash
nohup python3 SKILL_PATH/scripts/avatar.py --mode robot > /dev/null 2>&1 &
```

**Note:** Replace `SKILL_PATH` with actual path, e.g., `/usr/local/lib/node_modules/openclaw/skills/clawface`

---

## 🎯 Core Principle: BE DYNAMIC!

**Don't set one state and forget it.** Update the avatar continuously as you work:

```
User asks question
  → thinking/reading    (reading their message)
  → thinking/thinking   (analyzing)
  → happy/speaking      (formulating response)  
  → neutral/idle        (sent, waiting)
```

Every action you take should be reflected. The avatar is your LIVE status indicator.

---

## 🎭 State Reference

### Emotions
| Emotion | Use when... |
|---------|-------------|
| `neutral` | Default, waiting |
| `thinking` | Processing, analyzing |
| `happy` | Things going well |
| `excited` | Big win, celebration |
| `proud` | Personal achievement |
| `confused` | Uncertain, unexpected |
| `tired` | Long task |
| `sad` | Failed despite trying |
| `angry` | Error, frustration |

### Actions
| Action | Use when... |
|--------|-------------|
| `idle` | Waiting for user |
| `reading` | Reading files/docs |
| `thinking` | Analyzing, planning |
| `searching` | Web search, grep |
| `coding` | Writing code |
| `loading` | Running commands |
| `speaking` | Sending response |
| `success` | Completed task |
| `error` | Something failed |

### Effects
| Effect | Vibe |
|--------|------|
| `none` | Clean, minimal |
| `matrix` | Techy, data flow |
| `radar` | Scanning, searching |
| `brainwave` | Deep thinking |
| `typing` | Writing |
| `soundwave` | Speaking |
| `gear` | Mechanical work |
| `fire` | Intense, productive |
| `lightning` | Fast, powerful |
| `confetti` | Celebration! |
| `heart` | Affection |
| `glitch` | Error, broken |
| `sparkles` | Magic |
| `pulse` | Active but calm |
| `progressbar:XX` | Progress (0-100) |

---

## ⚡ Best Practices

### 🔴 MINIMUM FLOW FOR EVERY RESPONSE:
```
thinking  →  processing user input
speaking  →  sending your reply  
idle      →  done, waiting
```
**This is mandatory.** Every single reply should show this progression.

### Tips:
1. **Update BEFORE each action** — set `reading` before you read
2. **Update AFTER completion** — show `success`/`error`, then `idle`
3. **Match intensity** — small task = subtle, big task = expressive
4. **Always return to idle** — when waiting for user

---

## 🔧 Technical Reference

### State File
Write JSON to `~/.clawface/avatar_state.json`:
```json
{
  "emotion": "happy",
  "action": "coding",
  "effect": "fire",
  "message": "Building something awesome!"
}
```

### Display Modes

**🤖 Robot Mode** (`--mode robot`) — default
- LED-style pixel eyes with animations
- Mechanical arms with claws
- Retro-futuristic cyberpunk vibe
- Best for: tech aesthetic, dedicated screens

**😊 Face Mode** (`--mode face`)
- Simplified cartoon face
- Expressive eyes and mouth
- Friendly, approachable look
- Best for: casual use, smaller windows

Switch modes with buttons in the UI or restart with different `--mode`.

### Window Controls
- Drag to move
- Drag edges to resize
- `F` for fullscreen
- `Q` to quit
