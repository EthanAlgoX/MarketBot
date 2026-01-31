#!/usr/bin/env python3
"""
Moltbot Avatar v3 - Simple agent-controlled interface.

Interface: [emotion] + [action] + [effect] + [message]

Example state file (~/.clawface/avatar_state.json):
{
    "emotion": "happy",
    "action": "coding",
    "effect": "progressbar:50",
    "message": "Implementuję handlery..."
}
"""

import tkinter as tk
import json
import sys
import time
import threading
import math
import platform
from pathlib import Path
from typing import Optional
from dataclasses import dataclass

# ═══════════════════════════════════════════════════════════════════════════════
# PLATFORM DETECTION
# ═══════════════════════════════════════════════════════════════════════════════

PLATFORM = platform.system()  # 'Darwin', 'Windows', 'Linux'

# Fonts vary by platform
if PLATFORM == "Darwin":
    EMOJI_FONT = "Apple Color Emoji"
    MONO_FONT = "Menlo"
elif PLATFORM == "Windows":
    EMOJI_FONT = "Segoe UI Emoji"
    MONO_FONT = "Consolas"
else:  # Linux and others
    EMOJI_FONT = "Noto Color Emoji"
    MONO_FONT = "DejaVu Sans Mono"

# ═══════════════════════════════════════════════════════════════════════════════
# STATE DEFINITIONS
# ═══════════════════════════════════════════════════════════════════════════════

EMOTIONS = {
    "neutral": {"emoji": "🦞", "color": "#888888", "robot_eyes": "idle"},
    "happy": {"emoji": "😊🦞", "color": "#00ff88", "robot_eyes": "happy"},
    "excited": {"emoji": "🤩🦞", "color": "#ffff00", "robot_eyes": "star"},
    "thinking": {"emoji": "🤔🦞", "color": "#00ccff", "robot_eyes": "thinking"},
    "confused": {"emoji": "😵🦞", "color": "#ff88ff", "robot_eyes": "spiral"},
    "tired": {"emoji": "😴🦞", "color": "#666688", "robot_eyes": "sleepy"},
    "angry": {"emoji": "😤🦞", "color": "#ff4444", "robot_eyes": "angry"},
    "sad": {"emoji": "😢🦞", "color": "#4488ff", "robot_eyes": "sad"},
    "proud": {"emoji": "😎🦞", "color": "#ff8800", "robot_eyes": "cool"},
}

ACTIONS = {
    "idle": {"label": "STANDBY", "hands": "rest", "emoji_acc": None},
    "coding": {"label": "CODING", "hands": "typing", "emoji_acc": None},  # Keyboard already drawn
    "searching": {"label": "SEARCHING", "hands": "holding", "emoji_acc": "🔍"},
    "reading": {"label": "READING", "hands": "holding", "emoji_acc": "📄"},
    "loading": {"label": "LOADING", "hands": "waiting", "emoji_acc": "⏳"},
    "speaking": {"label": "OUTPUT", "hands": "gesture", "emoji_acc": "💬"},
    "success": {"label": "SUCCESS!", "hands": "raised", "emoji_acc": "🎉"},
    "error": {"label": "ERROR!", "hands": "facepalm", "emoji_acc": "💥"},
    "thinking": {"label": "THINKING", "hands": "chin", "emoji_acc": "💭"},
}

# ═══════════════════════════════════════════════════════════════════════════════
# EFFECTS - Visual effects (format: "effect_name" or "progressbar:0-100")
# ═══════════════════════════════════════════════════════════════════════════════

EFFECTS_INFO = {
    "none": "Brak efektu",
    "sparkles": "Iskierki wokół avatara",
    "pulse": "Pulsująca ramka",
    "progressbar": "Pasek postępu (progressbar:0-100)",
    "matrix": "Spadające znaki kodu (czytanie kodu)",
    "radar": "Skanowanie (szukanie w plikach)",
    "fire": "Płomienie (intensywna praca)",
    "confetti": "Konfetti (wielki sukces!)",
    "lightning": "Błyskawica (szybka akcja)",
    "glitch": "Glitch/zakłócenia (błąd)",
    "orbit": "Orbitujące elementy (ładowanie)",
    "soundwave": "Fala dźwiękowa (mówienie)",
    "brainwave": "Fale mózgowe (głębokie myślenie)",
    "upload": "Strzałki w górę (wysyłanie)",
    "download": "Strzałki w dół (pobieranie)",
    "typing": "Animowane kropki (pisanie)",
    "gear": "Kręcący się zębatka (instalacja)",
    "binary": "Spadające 0 i 1 (kompilacja)",
    "checkmarks": "Pojawiające się ptaszki (testy)",
    "branch": "Rozgałęzienia (git)",
    "heart": "Bijące serce (health check)",
    "snow": "Spadający śnieg (cleanup)",
    "rainbow": "Tęcza (wszystko super!)",
}


# ═══════════════════════════════════════════════════════════════════════════════
# HELPER FUNCTIONS
# ═══════════════════════════════════════════════════════════════════════════════

def darken_color(hex_color: str, factor: float) -> str:
    """Darken a hex color by a factor (0.0 = black, 1.0 = original)."""
    r = int(int(hex_color[1:3], 16) * factor)
    g = int(int(hex_color[3:5], 16) * factor)
    b = int(int(hex_color[5:7], 16) * factor)
    return f"#{r:02x}{g:02x}{b:02x}"

def blend_colors(color1: str, color2: str, ratio: float) -> str:
    """Blend two hex colors. ratio=1.0 means full color1, ratio=0.0 means full color2."""
    ratio = max(0.0, min(1.0, ratio))
    r1, g1, b1 = int(color1[1:3], 16), int(color1[3:5], 16), int(color1[5:7], 16)
    r2, g2, b2 = int(color2[1:3], 16), int(color2[3:5], 16), int(color2[5:7], 16)
    r = max(0, min(255, int(r1 * ratio + r2 * (1 - ratio))))
    g = max(0, min(255, int(g1 * ratio + g2 * (1 - ratio))))
    b = max(0, min(255, int(b1 * ratio + b2 * (1 - ratio))))
    return f"#{r:02x}{g:02x}{b:02x}"

def get_scale(w: int, h: int) -> float:
    """Calculate scale factor based on window size. Base size is 220x140."""
    return min(w / 220, h / 140)


def draw_subagent_bar(canvas: tk.Canvas, subagents, cx: int, y: int, scale: float = 1.0):
    """Draw subagent status icons centered above status label.

    Icons: ⏳ running, ✅ success, ❌ error, ⏱️ timeout, ❓ unknown
    """
    if not subagents:
        return

    font_size = max(8, int(10 * scale))

    # Handle simple int format (backwards compatible - shows as running)
    if isinstance(subagents, int):
        if subagents <= 0:
            return
        icons = "⏳" * min(subagents, 5)  # Max 5 icons
        if subagents > 5:
            icons += f"+{subagents - 5}"
        canvas.create_text(cx, y, text=icons, font=("Arial", font_size))
        return

    # Dict format: {"running": N, "success": N, "error": N, "timeout": N, "unknown": N}
    running = subagents.get("running", 0)
    success = subagents.get("success", 0)
    error = subagents.get("error", 0)
    timeout = subagents.get("timeout", 0)
    unknown = subagents.get("unknown", 0)

    total = running + success + error + timeout + unknown
    if total == 0:
        return

    # Build compact icon string (max 6 total to fit)
    icons = ""
    remaining = 6
    for count, icon in [(running, "⏳"), (success, "✅"), (error, "❌"), (timeout, "⏱️"), (unknown, "❓")]:
        show = min(count, remaining)
        icons += icon * show
        remaining -= show
        if remaining <= 0:
            break

    if total > 6:
        icons += f"+{total - 6}"

    canvas.create_text(cx, y, text=icons, font=("Arial", font_size))


# ═══════════════════════════════════════════════════════════════════════════════
# AVATAR STATE
# ═══════════════════════════════════════════════════════════════════════════════

@dataclass
class AvatarState:
    emotion: str = "neutral"
    action: str = "idle"
    effect: str = "none"
    message: str = ""
    subagents: any = None  # int or {"active": N, "done": N, "failed": N}

    @classmethod
    def from_dict(cls, data: dict) -> "AvatarState":
        return cls(
            emotion=data.get("emotion", "neutral"),
            action=data.get("action", "idle"),
            effect=data.get("effect", "none"),
            message=data.get("message", ""),
            subagents=data.get("subagents", None)
        )

    def get_progress(self) -> Optional[int]:
        """Extract progress value from effect like 'progressbar:50'"""
        if self.effect.startswith("progressbar:"):
            try:
                return int(self.effect.split(":")[1])
            except:
                pass
        return None


# ═══════════════════════════════════════════════════════════════════════════════
# DISPLAY MODES
# ═══════════════════════════════════════════════════════════════════════════════


class RobotRenderer:
    """Robot face with LED eyes."""

    # Eye patterns: 3x3 grid per eye, 1=on, 0=off
    # Format: [row1, row2, row3] where each row is [left_eye, right_eye]
    EYES = {
        "idle": [
            [[1,1,1], [1,1,1]],
            [[1,0,1], [1,0,1]],
            [[1,1,1], [1,1,1]],
        ],
        "happy": [  # ^ ^ eyes
            [[0,0,0], [0,0,0]],
            [[1,0,1], [1,0,1]],
            [[0,1,0], [0,1,0]],
        ],
        "star": [  # * * eyes
            [[1,0,1], [1,0,1]],
            [[0,1,0], [0,1,0]],
            [[1,0,1], [1,0,1]],
        ],
        "thinking": [  # - - eyes
            [[0,0,0], [0,0,0]],
            [[1,1,1], [1,1,1]],
            [[0,0,0], [0,0,0]],
        ],
        "sleepy": [  # _ _ eyes
            [[0,0,0], [0,0,0]],
            [[0,0,0], [0,0,0]],
            [[1,1,1], [1,1,1]],
        ],
        "angry": [  # \ / eyes
            [[1,0,0], [0,0,1]],
            [[0,1,0], [0,1,0]],
            [[0,0,1], [1,0,0]],
        ],
        "sad": [  # v v eyes (down)
            [[1,0,1], [1,0,1]],
            [[0,1,0], [0,1,0]],
            [[0,0,0], [0,0,0]],
        ],
        "spiral": [  # @ @ eyes
            [[0,1,1], [1,1,0]],
            [[1,0,1], [1,0,1]],
            [[1,1,0], [0,1,1]],
        ],
        "cool": [  # ■■ sunglasses
            [[1,1,1], [1,1,1]],
            [[1,1,1], [1,1,1]],
            [[0,0,0], [0,0,0]],
        ],
    }

    def render(self, canvas: tk.Canvas, state: AvatarState, frame: int, w: int, h: int):
        emo = EMOTIONS.get(state.emotion, EMOTIONS["neutral"])
        action = ACTIONS.get(state.action, ACTIONS["idle"])
        color = emo["color"]
        scale = get_scale(w, h)
        s = scale  # Shorthand

        canvas.config(bg="#1a1a2e")
        cx, cy = w // 2, h // 2 - int(5 * s)  # Shifted up for bottom effects

        # Status label
        status_y = int(26 * s)
        status_font = max(8, int(9 * s))
        canvas.create_text(cx, status_y, text=f"[ {action['label']} ]",
                          font=(MONO_FONT, status_font, "bold"), fill=color)

        # Head (scaled from 100x70px)
        head_w, head_h = int(50 * s), int(35 * s)
        shake = int(3 * s * math.sin(frame * 0.5)) if state.action == "error" else 0
        canvas.create_rectangle(
            cx - head_w + shake, cy - head_h, cx + head_w + shake, cy + head_h,
            fill="#2d2d2d", outline=color, width=max(1, int(2 * s))
        )

        # Antenna
        ant_x = cx + int(4 * s * math.sin(frame * 0.1))
        ant_h = int(10 * s)
        canvas.create_line(cx, cy - head_h, ant_x, cy - head_h - ant_h, fill=color, width=max(1, int(2 * s)))
        blink = color if frame % 20 < 15 else "#ff0000"
        ant_r = int(3 * s)
        canvas.create_oval(ant_x - ant_r, cy - head_h - ant_h - ant_r,
                          ant_x + ant_r, cy - head_h - ant_h + ant_r, fill=blink, outline="")

        # Eyes
        eye_pattern = self.EYES.get(emo["robot_eyes"], self.EYES["idle"])
        self._draw_eyes(canvas, cx + shake, cy - int(12 * s), eye_pattern, color, s)

        # Mouth
        mouth_y = cy + int(20 * s)
        mouth_font = max(8, int(11 * s))
        if state.action == "speaking":
            mouth = "▄█▀█▄" if frame % 10 < 5 else "▀█▄█▀"
        elif state.action == "error":
            mouth = "╭━━╮"
        elif state.emotion in ["happy", "excited", "proud"]:
            mouth = "╰━━╯"
        else:
            mouth = "━━━━"
        canvas.create_text(cx + shake, mouth_y, text=mouth, font=(MONO_FONT, mouth_font), fill=color)

        # Robot hands/arms based on action
        hands_y = cy + head_h + int(5 * s)
        head_top_right = (cx + head_w + shake, cy - head_h)  # Top-right corner of head
        self._draw_hands(canvas, cx + shake, hands_y, action, color, s, frame, head_top_right)

        # Subagent badge
        subagent_y = int(10 * s)
        draw_subagent_bar(canvas, state.subagents, cx, subagent_y, s)

        # Effects below robot
        self._render_effect(canvas, state, frame, w, h, color, cx, cy, s)

    def _draw_eyes(self, canvas, cx, cy, pattern, color, scale=1.0):
        """Draw LED-style eyes using 3x3 pixel grids."""
        pixel = max(3, int(5 * scale))  # Size of each LED pixel
        gap = max(1, int(1 * scale))    # Gap between pixels
        eye_gap = int(24 * scale)  # Gap between left and right eye

        # Left eye center, Right eye center
        left_cx = cx - eye_gap // 2 - pixel
        right_cx = cx + eye_gap // 2 + pixel

        for ri, row in enumerate(pattern):
            left_eye, right_eye = row
            for ci, on in enumerate(left_eye):
                px = left_cx - pixel - gap + ci * (pixel + gap)
                py = cy - pixel - gap + ri * (pixel + gap)
                fill = color if on else "#222"
                canvas.create_rectangle(px, py, px + pixel, py + pixel, fill=fill, outline="#111")

            for ci, on in enumerate(right_eye):
                px = right_cx - pixel - gap + ci * (pixel + gap)
                py = cy - pixel - gap + ri * (pixel + gap)
                fill = color if on else "#222"
                canvas.create_rectangle(px, py, px + pixel, py + pixel, fill=fill, outline="#111")

    def _draw_hands(self, canvas, cx, y, action, color, scale, frame, head_corner=None):
        """Draw robot hands/arms based on action."""
        s = scale
        hands_type = action.get("hands", "rest")
        emoji_acc = action.get("emoji_acc")
        arm_len = int(18 * s)  # Slightly shorter to leave room
        lw = max(4, int(6 * s))  # Thicker robot arms

        # Claws/hands at end of arms
        claw_w = int(6 * s)
        claw_h = int(8 * s)

        # For thinking/loading/success/speaking - icon goes at head corner
        icon_at_head = hands_type in ["chin", "waiting", "raised", "gesture"]
        acc_x, acc_y = cx, y + int(20 * s)  # Default accessory position

        if hands_type == "rest":
            # Arms down at sides with claws
            lx, rx = cx - int(40 * s), cx + int(40 * s)
            canvas.create_line(lx, y, lx, y + arm_len, fill=color, width=lw)
            canvas.create_line(rx, y, rx, y + arm_len, fill=color, width=lw)
            # Claws
            canvas.create_rectangle(lx - claw_w//2, y + arm_len, lx + claw_w//2, y + arm_len + claw_h, fill=color)
            canvas.create_rectangle(rx - claw_w//2, y + arm_len, rx + claw_w//2, y + arm_len + claw_h, fill=color)
        elif hands_type == "typing":
            # Keyboard body first (so hands render on top)
            kb_w, kb_h = int(38 * s), int(18 * s)
            kb_y = y + int(15 * s)
            canvas.create_rectangle(cx - kb_w, kb_y, cx + kb_w, kb_y + kb_h,
                                   fill="#222", outline="#444", width=max(1, int(s)))
            # Keyboard keys (3 rows)
            key_w, key_h = int(6 * s), int(4 * s)
            key_gap = int(2 * s)
            for row in range(3):
                row_y = kb_y + int(3 * s) + row * (key_h + key_gap)
                keys_in_row = 9 - row
                start_x = cx - (keys_in_row * (key_w + key_gap)) // 2
                for k in range(keys_in_row):
                    kx = start_x + k * (key_w + key_gap)
                    canvas.create_rectangle(kx, row_y, kx + key_w, row_y + key_h,
                                          fill="#555", outline="")
            # Arms forward, animated typing (on top of keyboard)
            offset = int(4 * s * math.sin(frame * 0.5))
            canvas.create_line(cx - int(30 * s), y, cx - int(15 * s), y + int(10 * s) + offset, fill=color, width=lw)
            canvas.create_line(cx + int(30 * s), y, cx + int(15 * s), y + int(10 * s) - offset, fill=color, width=lw)
            # Claws on keyboard
            canvas.create_rectangle(cx - int(18 * s), y + int(7 * s) + offset, cx - int(12 * s), y + int(14 * s) + offset, fill=color)
            canvas.create_rectangle(cx + int(12 * s), y + int(7 * s) - offset, cx + int(18 * s), y + int(14 * s) - offset, fill=color)
        elif hands_type == "holding":
            # Arms curved inward holding something
            canvas.create_line(cx - int(35 * s), y, cx - int(15 * s), y + int(12 * s), fill=color, width=lw)
            canvas.create_line(cx + int(35 * s), y, cx + int(15 * s), y + int(12 * s), fill=color, width=lw)
            # Claws
            canvas.create_rectangle(cx - int(18 * s), y + int(9 * s), cx - int(12 * s), y + int(18 * s), fill=color)
            canvas.create_rectangle(cx + int(12 * s), y + int(9 * s), cx + int(18 * s), y + int(18 * s), fill=color)
            acc_y = y + int(5 * s)  # Accessory between claws
        elif hands_type == "raised":
            # Arms up in celebration
            canvas.create_line(cx - int(35 * s), y, cx - int(50 * s), y - int(25 * s), fill=color, width=lw)
            canvas.create_line(cx + int(35 * s), y, cx + int(50 * s), y - int(25 * s), fill=color, width=lw)
            # Claws up
            canvas.create_rectangle(cx - int(53 * s), y - int(25 * s), cx - int(47 * s), y - int(15 * s), fill=color)
            canvas.create_rectangle(cx + int(47 * s), y - int(25 * s), cx + int(53 * s), y - int(15 * s), fill=color)
        elif hands_type == "facepalm":
            # One arm up to face
            canvas.create_line(cx - int(30 * s), y, cx - int(10 * s), y - int(25 * s), fill=color, width=lw)
            canvas.create_line(cx + int(35 * s), y, cx + int(35 * s), y + arm_len, fill=color, width=lw)
            # Claw on face
            canvas.create_rectangle(cx - int(13 * s), y - int(28 * s), cx - int(7 * s), y - int(18 * s), fill=color)
            acc_x = cx + int(35 * s)
            acc_y = y + int(25 * s)
        elif hands_type == "chin":
            # Hand on chin thinking
            canvas.create_line(cx - int(20 * s), y, cx - int(5 * s), y - int(8 * s), fill=color, width=lw)
            canvas.create_line(cx + int(35 * s), y, cx + int(35 * s), y + arm_len, fill=color, width=lw)
            # Claw on chin
            canvas.create_rectangle(cx - int(8 * s), y - int(10 * s), cx - int(2 * s), y, fill=color)
        elif hands_type == "gesture":
            # Animated gesturing
            wave = int(10 * s * math.sin(frame * 0.2))
            canvas.create_line(cx - int(35 * s), y, cx - int(50 * s) + wave, y - int(15 * s), fill=color, width=lw)
            canvas.create_line(cx + int(35 * s), y, cx + int(50 * s) - wave, y - int(15 * s), fill=color, width=lw)
            # Claws waving
            canvas.create_rectangle(cx - int(53 * s) + wave, y - int(18 * s), cx - int(47 * s) + wave, y - int(8 * s), fill=color)
            canvas.create_rectangle(cx + int(47 * s) - wave, y - int(18 * s), cx + int(53 * s) - wave, y - int(8 * s), fill=color)
        elif hands_type == "waiting":
            # Arms crossed / waiting
            canvas.create_line(cx - int(30 * s), y, cx + int(10 * s), y + int(8 * s), fill=color, width=lw)
            canvas.create_line(cx + int(30 * s), y, cx - int(10 * s), y + int(8 * s), fill=color, width=lw)
            # Claws crossed
            canvas.create_rectangle(cx + int(7 * s), y + int(5 * s), cx + int(13 * s), y + int(14 * s), fill=color)
            canvas.create_rectangle(cx - int(13 * s), y + int(5 * s), cx - int(7 * s), y + int(14 * s), fill=color)

        # Draw action accessory (emoji attribute)
        if emoji_acc:
            # Make error explosion bigger
            if hands_type == "facepalm":
                acc_font = max(20, int(28 * s))
            else:
                acc_font = max(14, int(18 * s))
            if icon_at_head and head_corner:
                # Draw at top-right corner of head
                hx, hy = head_corner
                canvas.create_text(hx + int(12 * s), hy - int(5 * s), text=emoji_acc,
                                 font=(EMOJI_FONT, acc_font))
            else:
                canvas.create_text(acc_x, acc_y, text=emoji_acc, font=(EMOJI_FONT, acc_font))

    def _render_effect(self, canvas, state, frame, w, h, color, cx, cy, scale=1.0):
        progress = state.get_progress()
        effect = state.effect
        s = scale
        effect_y = h - int(30 * s)  # More room at bottom

        if progress is not None:
            bar_w, bar_h = int(80 * s), int(6 * s)
            bar_x = cx - bar_w // 2
            canvas.create_rectangle(bar_x, effect_y, bar_x + bar_w, effect_y + bar_h,
                                   fill="#333", outline=color)
            fill_w = int(bar_w * progress / 100)
            canvas.create_rectangle(bar_x + 1, effect_y + 1, bar_x + fill_w, effect_y + bar_h - 1,
                                   fill=color, outline="")

        elif effect == "sparkles":
            emoji_size = max(8, int(12 * s))
            for i in range(6):
                angle = frame * 0.12 + i * (math.pi / 3)
                x = cx + int(55 * s * math.cos(angle))
                y = cy + int(35 * s * math.sin(angle))
                canvas.create_text(x, y, text="✨", font=("Arial", emoji_size))

        elif effect == "pulse":
            pulse = int(12 * s * abs(math.sin(frame * 0.12)))
            # Make pulse bigger than robot head (head is 50x35)
            canvas.create_rectangle(cx - int(60 * s) - pulse, cy - int(45 * s) - pulse,
                                  cx + int(60 * s) + pulse, cy + int(45 * s) + pulse,
                                  outline=color, width=max(2, int(3 * s)))

        elif effect == "matrix":
            chars = "10<>/{}=+-"
            font_size = max(7, int(9 * s))
            col_spacing = max(12, int(15 * s))
            num_cols = max(12, w // col_spacing + 2)  # More columns, cover full width
            for i in range(num_cols):
                x = i * col_spacing
                y = (frame * 4 + i * int(20 * s)) % h
                canvas.create_text(x, y, text=chars[(frame + i) % len(chars)],
                                 font=(MONO_FONT, font_size), fill="#00ff00")

        elif effect == "radar":
            angle = frame * 0.12
            r = int(25 * s)
            canvas.create_oval(cx - r, effect_y - int(18 * s), cx + r, effect_y + int(7 * s),
                             outline=color, width=max(1, int(s)))
            x2 = cx + int(22 * s * math.cos(angle))
            y2 = effect_y - int(5 * s) + int(10 * s * math.sin(angle))
            canvas.create_line(cx, effect_y - int(5 * s), x2, y2, fill=color, width=max(2, int(2 * s)))

        elif effect == "fire":
            emoji_size = max(10, int(14 * s))
            fire_y = h - int(8 * s)  # Very bottom
            for i in range(5):
                x = cx - int(40 * s) + i * int(20 * s)
                offset = int(5 * s * math.sin(frame * 0.4 + i))
                canvas.create_text(x, fire_y - offset, text="🔥", font=("Arial", emoji_size))

        elif effect == "confetti":
            shapes = ["🎉", "🎊", "✨", "⭐", "💫"]
            emoji_size = max(8, int(12 * s))
            num_conf = max(15, int(w / 15))  # More confetti
            for i in range(num_conf):
                x = (frame * 3 + i * int(22 * s)) % w
                y = (frame * 2 + i * int(18 * s)) % h
                canvas.create_text(x, y, text=shapes[i % len(shapes)], font=("Arial", emoji_size))

        elif effect == "lightning":
            if frame % 12 < 3:
                canvas.create_rectangle(0, 0, w, h, fill="", outline="#ffff00", width=max(3, int(4 * s)))

        elif effect == "glitch":
            if frame % 4 < 2:
                num_lines = max(6, h // int(25 * s))  # More glitch lines
                for i in range(num_lines):
                    y = int(20 * s) + i * int(22 * s)  # Spread across screen
                    offset = int(15 * s * math.sin(frame * 2 + i * 50))
                    canvas.create_line(0, y, w, y, fill="#ff0000", width=max(2, int(3 * s)))
                    canvas.create_line(offset, y + int(6 * s), w, y + int(6 * s), fill="#00ffff", width=max(2, int(3 * s)))

        elif effect == "orbit":
            font_size = max(10, int(14 * s))
            for i in range(3):
                angle = frame * 0.1 + i * (2 * math.pi / 3)
                x = cx + int(65 * s * math.cos(angle))
                y = cy + int(40 * s * math.sin(angle))
                canvas.create_text(x, y, text="●", font=("Arial", font_size), fill=color)

        elif effect == "soundwave":
            for i in range(7):
                x = cx - int(30 * s) + i * int(10 * s)
                amp = abs(math.sin(frame * 0.25 + i * 0.5)) * int(12 * s)
                canvas.create_line(x, effect_y - amp, x, effect_y + amp, fill=color, width=max(2, int(3 * s)))

        elif effect == "brainwave":
            for i in range(4):
                r = int((55 + i * 15) * s) + int(5 * s * math.sin(frame * 0.1 - i * 0.4))
                canvas.create_oval(cx - r, cy - int(r * 0.6), cx + r, cy + int(r * 0.6),
                                 outline=color, width=max(2, int(2 * s)))

        elif effect == "upload":
            font_size = max(10, int(14 * s))
            for i in range(4):
                y = h - (frame * 5 + i * int(35 * s)) % h
                canvas.create_text(int(15 * s), y, text="▲", font=("Arial", font_size), fill=color)
                canvas.create_text(w - int(15 * s), y, text="▲", font=("Arial", font_size), fill=color)

        elif effect == "download":
            font_size = max(10, int(14 * s))
            for i in range(4):
                y = (frame * 5 + i * int(35 * s)) % h
                canvas.create_text(int(15 * s), y, text="▼", font=("Arial", font_size), fill=color)
                canvas.create_text(w - int(15 * s), y, text="▼", font=("Arial", font_size), fill=color)

        elif effect == "typing":
            dots = "●" * ((frame // 8) % 4)
            font_size = max(10, int(14 * s))
            canvas.create_text(cx, effect_y, text=dots.ljust(3), font=("Arial", font_size), fill=color)

        elif effect == "gear":
            spinner = "◐◓◑◒"[frame % 4]
            font_size = max(12, int(16 * s))
            canvas.create_text(int(15 * s), cy, text=spinner, font=("Arial", font_size), fill=color)
            canvas.create_text(w - int(15 * s), cy, text=spinner, font=("Arial", font_size), fill=color)

        elif effect == "binary":
            font_size = max(8, int(10 * s))
            for i in range(8):
                x = int(10 * s) + i * int(18 * s)
                y = (frame * 5 + i * int(18 * s)) % h
                canvas.create_text(x, y, text=str((frame + i) % 2), font=(MONO_FONT, font_size), fill="#00ff00")

        elif effect == "checkmarks":
            font_size = max(10, int(14 * s))
            n = min((frame // 10) % 6, 5)
            for i in range(n):
                x = cx - int(40 * s) + i * int(20 * s)
                canvas.create_text(x, effect_y, text="✓", font=("Arial", font_size), fill="#00ff00")

        elif effect == "branch":
            lw = max(2, int(2 * s))
            canvas.create_line(cx - int(30 * s), effect_y, cx, effect_y, fill=color, width=lw)
            canvas.create_line(cx, effect_y, cx + int(25 * s), effect_y - int(10 * s), fill="#ff8800", width=lw)
            canvas.create_line(cx, effect_y, cx + 25, effect_y + 10, fill="#00ff88", width=2)

        elif effect == "heart":
            pulse = 1 + 0.3 * abs(math.sin(frame * 0.2))
            size = int(24 * s * pulse)
            margin = int(25 * s)
            canvas.create_text(margin, cy, text="❤", font=("Arial", size), fill="#ff4466")
            canvas.create_text(w - margin, cy, text="❤", font=("Arial", size), fill="#ff4466")

        elif effect == "snow":
            num_flakes = max(18, int(w / 12))  # More snowflakes
            for i in range(num_flakes):
                x = (i * int(18 * s) + frame * 2) % w
                y = (frame * 2 + i * int(15 * s)) % h
                canvas.create_text(x, y, text="❄", font=("Arial", max(10, int(12 * s))), fill="#aaddff")

        elif effect == "rainbow":
            colors_list = ["#ff0000", "#ff8800", "#ffff00", "#00ff00", "#0088ff", "#8800ff"]
            line_h = max(3, int(4 * s))
            for i, c in enumerate(colors_list):
                y_pos = effect_y + i * line_h
                canvas.create_line(int(15 * s), y_pos, w - int(15 * s), y_pos, fill=c, width=line_h)


class FaceRenderer:
    """Simple cartoon face - clear emotions, no hair."""

    SKIN = "#ffdd99"
    SKIN_OUTLINE = "#cc9966"
    BROW = "#555555"
    BLUSH = "#ffaaaa"

    def render(self, canvas: tk.Canvas, state: AvatarState, frame: int, w: int, h: int):
        emo = EMOTIONS.get(state.emotion, EMOTIONS["neutral"])
        action = ACTIONS.get(state.action, ACTIONS["idle"])
        color = emo["color"]
        scale = get_scale(w, h)
        s = scale  # Shorthand

        canvas.config(bg="#1a1a2e")
        cx, cy = w // 2, h // 2 - int(5 * s)  # Shifted up for bottom effects

        shake = int(3 * s * math.sin(frame * 0.5)) if state.action == "error" else 0

        # Status label
        status_y = int(26 * s)
        status_font = max(8, int(9 * s))
        canvas.create_text(cx, status_y, text=f"[ {action['label']} ]",
                          font=(MONO_FONT, status_font, "bold"), fill=color)

        # Simple round face
        face_r = int(38 * s)
        canvas.create_oval(cx - face_r + shake, cy - face_r,
                          cx + face_r + shake, cy + face_r,
                          fill=self.SKIN, outline=self.SKIN_OUTLINE, width=max(1, int(2 * s)))

        # Draw eyes
        self._draw_eyes(canvas, cx + shake, cy - int(8 * s), state.emotion, frame, s)

        # Eyebrows
        self._draw_eyebrows(canvas, cx + shake, cy - int(22 * s), state.emotion, s)

        # Blush for happy emotions
        if state.emotion in ["happy", "excited", "proud"]:
            blush_offset = int(25 * s)
            blush_size = int(5 * s)
            canvas.create_oval(cx - blush_offset + shake, cy + int(5 * s),
                              cx - blush_offset + blush_size + shake, cy + int(12 * s),
                              fill=self.BLUSH, outline="")
            canvas.create_oval(cx + blush_offset - blush_size + shake, cy + int(5 * s),
                              cx + blush_offset + shake, cy + int(12 * s),
                              fill=self.BLUSH, outline="")

        # Mouth
        self._draw_mouth(canvas, cx + shake, cy + int(20 * s), state.emotion, state.action, frame, s)

        # Hands below face
        hands_y = cy + face_r + int(5 * s)
        head_top_right = (cx + face_r + shake, cy - face_r)  # Top-right corner of face
        self._draw_hands(canvas, cx + shake, hands_y, action, color, s, frame, head_top_right)

        # Subagent badge
        subagent_y = int(10 * s)
        draw_subagent_bar(canvas, state.subagents, cx, subagent_y, s)

        # Effects at bottom
        self._render_effect(canvas, state, frame, w, h, color, cy, s)

    def _draw_hands(self, canvas, cx, y, action, color, scale, frame, head_corner=None):
        """Draw cartoon hands based on action."""
        s = scale
        hands_type = action.get("hands", "rest")
        emoji_acc = action.get("emoji_acc")
        skin = self.SKIN
        outline = self.SKIN_OUTLINE
        hand_r = int(10 * s)  # Slightly bigger hands
        lw = max(2, int(3 * s))

        # For thinking/loading/success/speaking - icon goes at head corner
        icon_at_head = hands_type in ["chin", "waiting", "raised", "gesture"]
        acc_x, acc_y = cx, y + int(20 * s)  # Default accessory position

        if hands_type == "rest":
            # Small hands at sides
            canvas.create_oval(cx - int(45 * s), y, cx - int(45 * s) + hand_r * 2, y + hand_r * 2,
                             fill=skin, outline=outline, width=lw)
            canvas.create_oval(cx + int(45 * s) - hand_r * 2, y, cx + int(45 * s), y + hand_r * 2,
                             fill=skin, outline=outline, width=lw)
        elif hands_type == "typing":
            # Keyboard body first (so hands render on top)
            kb_w, kb_h = int(38 * s), int(18 * s)
            kb_y = y + int(12 * s)
            canvas.create_rectangle(cx - kb_w, kb_y, cx + kb_w, kb_y + kb_h,
                                   fill="#222", outline="#444", width=max(1, int(s)))
            # Keyboard keys (3 rows)
            key_w, key_h = int(6 * s), int(4 * s)
            key_gap = int(2 * s)
            for row in range(3):
                row_y = kb_y + int(3 * s) + row * (key_h + key_gap)
                keys_in_row = 9 - row
                start_x = cx - (keys_in_row * (key_w + key_gap)) // 2
                for k in range(keys_in_row):
                    kx = start_x + k * (key_w + key_gap)
                    canvas.create_rectangle(kx, row_y, kx + key_w, row_y + key_h,
                                          fill="#555", outline="")
            # Hands on keyboard, animated (on top of keyboard)
            offset = int(3 * s * math.sin(frame * 0.5))
            canvas.create_oval(cx - int(20 * s), y + offset, cx - int(20 * s) + hand_r * 2, y + hand_r * 2 + offset,
                             fill=skin, outline=outline, width=lw)
            canvas.create_oval(cx + int(20 * s) - hand_r * 2, y - offset, cx + int(20 * s), y + hand_r * 2 - offset,
                             fill=skin, outline=outline, width=lw)
        elif hands_type == "holding":
            # Hands together holding something
            canvas.create_oval(cx - int(14 * s), y, cx - int(14 * s) + hand_r * 2, y + hand_r * 2,
                             fill=skin, outline=outline, width=lw)
            canvas.create_oval(cx + int(14 * s) - hand_r * 2, y, cx + int(14 * s), y + hand_r * 2,
                             fill=skin, outline=outline, width=lw)
            acc_y = y + int(5 * s)  # Accessory between hands
        elif hands_type == "raised":
            # Hands up celebrating
            canvas.create_oval(cx - int(55 * s), y - int(30 * s), cx - int(55 * s) + hand_r * 2, y - int(30 * s) + hand_r * 2,
                             fill=skin, outline=outline, width=lw)
            canvas.create_oval(cx + int(55 * s) - hand_r * 2, y - int(30 * s), cx + int(55 * s), y - int(30 * s) + hand_r * 2,
                             fill=skin, outline=outline, width=lw)
        elif hands_type == "facepalm":
            # One hand on face
            canvas.create_oval(cx - int(18 * s), y - int(35 * s), cx - int(18 * s) + hand_r * 2, y - int(35 * s) + hand_r * 2,
                             fill=skin, outline=outline, width=lw)
            acc_x = cx + int(40 * s)
            acc_y = y + int(5 * s)
        elif hands_type == "chin":
            # One arm up to chin, other arm down
            arm_lw = max(6, int(8 * s))
            # Left arm to chin
            canvas.create_line(cx - int(40 * s), y - int(20 * s), cx - int(5 * s), y - int(20 * s),
                             fill=skin, width=arm_lw)
            # Right arm down
            canvas.create_line(cx + int(40 * s), y - int(20 * s), cx + int(40 * s), y + int(5 * s),
                             fill=skin, width=arm_lw)
            # Hand on chin
            canvas.create_oval(cx - int(12 * s), y - int(25 * s), cx - int(12 * s) + hand_r * 2, y - int(25 * s) + hand_r * 2,
                             fill=skin, outline=outline, width=lw)
            # Hand at side
            canvas.create_oval(cx + int(35 * s), y, cx + int(35 * s) + hand_r * 2, y + hand_r * 2,
                             fill=skin, outline=outline, width=lw)
        elif hands_type == "gesture":
            # Animated waving
            wave = int(15 * s * math.sin(frame * 0.2))
            canvas.create_oval(cx - int(55 * s) + wave, y - int(12 * s), cx - int(55 * s) + wave + hand_r * 2, y - int(12 * s) + hand_r * 2,
                             fill=skin, outline=outline, width=lw)
            canvas.create_oval(cx + int(55 * s) - wave - hand_r * 2, y - int(12 * s), cx + int(55 * s) - wave, y - int(12 * s) + hand_r * 2,
                             fill=skin, outline=outline, width=lw)
        elif hands_type == "waiting":
            # Arms down, hands clasped in front
            arm_lw = max(6, int(8 * s))
            # Left arm
            canvas.create_line(cx - int(40 * s), y - int(20 * s), cx - int(15 * s), y + int(5 * s),
                             fill=skin, width=arm_lw)
            # Right arm
            canvas.create_line(cx + int(40 * s), y - int(20 * s), cx + int(15 * s), y + int(5 * s),
                             fill=skin, width=arm_lw)
            # Two hands clasped
            canvas.create_oval(cx - int(15 * s), y, cx - int(15 * s) + hand_r * 2, y + hand_r * 2,
                             fill=skin, outline=outline, width=lw)
            canvas.create_oval(cx + int(15 * s) - hand_r * 2, y, cx + int(15 * s), y + hand_r * 2,
                             fill=skin, outline=outline, width=lw)

        # Draw action accessory (emoji attribute)
        if emoji_acc:
            # Make error explosion bigger
            if hands_type == "facepalm":
                acc_font = max(20, int(28 * s))
            else:
                acc_font = max(14, int(18 * s))
            if icon_at_head and head_corner:
                # Draw at top-right corner of head
                hx, hy = head_corner
                canvas.create_text(hx + int(10 * s), hy - int(5 * s), text=emoji_acc,
                                 font=(EMOJI_FONT, acc_font))
            else:
                canvas.create_text(acc_x, acc_y, text=emoji_acc, font=(EMOJI_FONT, acc_font))

    def _draw_eyes(self, canvas, cx, cy, emotion, frame, scale=1.0):
        """Draw expressive eyes."""
        s = scale
        left_x, right_x = cx - int(14 * s), cx + int(14 * s)
        eye_r = int(8 * s)

        if emotion in ["sleepy", "tired"]:
            # Half-closed
            canvas.create_arc(left_x - eye_r, cy - 2, left_x + eye_r, cy + 8,
                            start=0, extent=180, fill="white", outline="#333", width=2)
            canvas.create_arc(right_x - eye_r, cy - 2, right_x + eye_r, cy + 8,
                            start=0, extent=180, fill="white", outline="#333", width=2)
            canvas.create_oval(left_x - 2, cy + 1, left_x + 2, cy + 5, fill="#333")
            canvas.create_oval(right_x - 2, cy + 1, right_x + 2, cy + 5, fill="#333")
        elif emotion == "angry":
            # Narrowed
            canvas.create_oval(left_x - eye_r, cy - 4, left_x + eye_r, cy + 4,
                             fill="white", outline="#333", width=2)
            canvas.create_oval(right_x - eye_r, cy - 4, right_x + eye_r, cy + 4,
                             fill="white", outline="#333", width=2)
            canvas.create_oval(left_x - 3, cy - 3, left_x + 3, cy + 3, fill="#333")
            canvas.create_oval(right_x - 3, cy - 3, right_x + 3, cy + 3, fill="#333")
        elif emotion == "excited":
            # Stars
            canvas.create_oval(left_x - eye_r, cy - eye_r, left_x + eye_r, cy + eye_r,
                             fill="white", outline="#333", width=2)
            canvas.create_oval(right_x - eye_r, cy - eye_r, right_x + eye_r, cy + eye_r,
                             fill="white", outline="#333", width=2)
            canvas.create_text(left_x, cy, text="★", font=("Arial", 9), fill="#ffaa00")
            canvas.create_text(right_x, cy, text="★", font=("Arial", 9), fill="#ffaa00")
        elif emotion == "sad":
            # Droopy with tear
            canvas.create_oval(left_x - eye_r, cy - eye_r + 2, left_x + eye_r, cy + eye_r + 2,
                             fill="white", outline="#333", width=2)
            canvas.create_oval(right_x - eye_r, cy - eye_r + 2, right_x + eye_r, cy + eye_r + 2,
                             fill="white", outline="#333", width=2)
            canvas.create_oval(left_x - 3, cy + 1, left_x + 3, cy + 7, fill="#333")
            canvas.create_oval(right_x - 3, cy + 1, right_x + 3, cy + 7, fill="#333")
            # Tear
            canvas.create_oval(left_x + 10, cy + 4, left_x + 14, cy + 10, fill="#88ccff", outline="")
        elif emotion == "confused":
            # Spirals
            canvas.create_oval(left_x - eye_r, cy - eye_r, left_x + eye_r, cy + eye_r,
                             fill="white", outline="#333", width=2)
            canvas.create_oval(right_x - eye_r, cy - eye_r, right_x + eye_r, cy + eye_r,
                             fill="white", outline="#333", width=2)
            canvas.create_text(left_x, cy, text="@", font=("Arial", 9, "bold"), fill="#333")
            canvas.create_text(right_x, cy, text="@", font=("Arial", 9, "bold"), fill="#333")
        elif emotion == "proud":
            # Smug closed
            canvas.create_arc(left_x - eye_r, cy - 3, left_x + eye_r, cy + 8,
                            start=0, extent=180, fill="", outline="#333", width=2)
            canvas.create_arc(right_x - eye_r, cy - 3, right_x + eye_r, cy + 8,
                            start=0, extent=180, fill="", outline="#333", width=2)
        else:
            # Normal
            canvas.create_oval(left_x - eye_r, cy - eye_r, left_x + eye_r, cy + eye_r,
                             fill="white", outline="#333", width=2)
            canvas.create_oval(right_x - eye_r, cy - eye_r, right_x + eye_r, cy + eye_r,
                             fill="white", outline="#333", width=2)
            # Pupils
            offset = 2 * math.sin(frame * 0.05) if emotion == "thinking" else 0
            canvas.create_oval(left_x - 3 + offset, cy - 3, left_x + 3 + offset, cy + 3, fill="#333")
            canvas.create_oval(right_x - 3 + offset, cy - 3, right_x + 3 + offset, cy + 3, fill="#333")
            # Highlight
            canvas.create_oval(left_x - 1, cy - 3, left_x + 2, cy, fill="white", outline="")
            canvas.create_oval(right_x - 1, cy - 3, right_x + 2, cy, fill="white", outline="")

    def _draw_eyebrows(self, canvas, cx, cy, emotion, scale=1.0):
        """Draw expressive eyebrows."""
        s = scale
        left_x, right_x = cx - int(14 * s), cx + int(14 * s)
        w = max(2, int(3 * s))
        off = int(8 * s)

        if emotion == "angry":
            canvas.create_line(left_x - off, cy - int(3*s), left_x + int(6*s), cy + int(3*s), fill=self.BROW, width=w)
            canvas.create_line(right_x - int(6*s), cy + int(3*s), right_x + off, cy - int(3*s), fill=self.BROW, width=w)
        elif emotion == "sad":
            canvas.create_line(left_x - off, cy + int(2*s), left_x + int(6*s), cy - int(2*s), fill=self.BROW, width=w)
            canvas.create_line(right_x - int(6*s), cy - int(2*s), right_x + off, cy + int(2*s), fill=self.BROW, width=w)
        elif emotion == "confused":
            canvas.create_line(left_x - off, cy, left_x + int(6*s), cy - int(4*s), fill=self.BROW, width=w)
            canvas.create_line(right_x - int(6*s), cy, right_x + off, cy, fill=self.BROW, width=w)
        elif emotion in ["excited", "happy"]:
            canvas.create_arc(left_x - off, cy - int(3*s), left_x + off, cy + int(6*s),
                            start=0, extent=180, fill="", outline=self.BROW, width=w)
            canvas.create_arc(right_x - off, cy - int(3*s), right_x + off, cy + int(6*s),
                            start=0, extent=180, fill="", outline=self.BROW, width=w)
        else:
            canvas.create_line(left_x - off, cy, left_x + int(6*s), cy, fill=self.BROW, width=w)
            canvas.create_line(right_x - int(6*s), cy, right_x + off, cy, fill=self.BROW, width=w)

    def _draw_mouth(self, canvas, cx, cy, emotion, action, frame, scale=1.0):
        """Draw expressive mouth."""
        s = scale
        w = max(2, int(2 * s))
        if action == "speaking":
            open_h = abs(math.sin(frame * 0.3)) * int(8 * s)
            canvas.create_oval(cx - int(10*s), cy - int(4*s), cx + int(10*s), cy + int(4*s) + open_h,
                             fill="#cc6666", outline="#993333", width=w)
        elif emotion in ["happy", "excited"]:
            canvas.create_arc(cx - int(15*s), cy - int(12*s), cx + int(15*s), cy + int(12*s),
                            start=180, extent=180, fill="#cc6666", outline="#993333", width=w)
        elif emotion == "proud":
            canvas.create_arc(cx - int(12*s), cy - int(8*s), cx + int(15*s), cy + int(8*s),
                            start=200, extent=140, fill="", outline="#993333", width=max(2, int(3*s)))
        elif emotion == "sad":
            canvas.create_arc(cx - int(12*s), cy, cx + int(12*s), cy + int(15*s),
                            start=0, extent=180, fill="", outline="#993333", width=max(2, int(3*s)))
        elif emotion == "angry":
            canvas.create_rectangle(cx - int(12*s), cy - int(2*s), cx + int(12*s), cy + int(6*s),
                                  fill="#cc6666", outline="#993333", width=w)
            for i in range(4):
                x = cx - int(9*s) + i * int(6*s)
                canvas.create_line(x, cy - int(2*s), x, cy + int(6*s), fill="#ffffff", width=w)
        elif emotion == "confused":
            points = []
            for i in range(6):
                x = cx - int(12*s) + i * int(5*s)
                y = cy + int(3*s) * math.sin(i + frame * 0.1)
                points.extend([x, y])
            canvas.create_line(*points, fill="#993333", width=max(2, int(3*s)), smooth=True)
        elif emotion == "tired":
            canvas.create_oval(cx - int(6*s), cy - int(4*s), cx + int(6*s), cy + int(6*s),
                             fill="#cc6666", outline="#993333", width=w)
        else:
            canvas.create_arc(cx - int(10*s), cy - int(6*s), cx + int(10*s), cy + int(6*s),
                            start=200, extent=140, fill="", outline="#993333", width=max(2, int(3*s)))

    def _render_effect(self, canvas, state, frame, w, h, color, face_cy, scale=1.0):
        """Render effects around/below the face."""
        effect = state.effect
        progress = state.get_progress()
        cx = w // 2
        s = scale
        effect_y = h - int(30 * s)  # More room for effects
        font_sm = max(10, int(12 * s))
        font_md = max(12, int(14 * s))
        font_lg = max(14, int(16 * s))

        if progress is not None:
            bar_w, bar_h = int(90 * s), int(6 * s)
            bar_x = (w - bar_w) // 2
            canvas.create_rectangle(bar_x, effect_y, bar_x + bar_w, effect_y + bar_h,
                                   fill="#222", outline=color)
            fill_w = int(bar_w * progress / 100)
            canvas.create_rectangle(bar_x + 1, effect_y + 1, bar_x + fill_w, effect_y + bar_h - 1,
                                   fill=color, outline="")

        elif effect == "sparkles":
            for i in range(6):
                angle = frame * 0.12 + i * (math.pi / 3)
                x = cx + int(55 * s * math.cos(angle))
                y = face_cy + int(40 * s * math.sin(angle))
                canvas.create_text(x, y, text="✨", font=("Arial", font_sm))

        elif effect == "pulse":
            pulse = int(12 * s * abs(math.sin(frame * 0.12)))
            r = int(55 * s)  # Bigger than face (face_r is 38)
            canvas.create_oval(cx - r - pulse, face_cy - r - pulse,
                             cx + r + pulse, face_cy + r + pulse,
                             outline=color, width=max(2, int(3 * s)))

        elif effect == "matrix":
            chars = "01<>/{}=;"
            col_spacing = max(12, int(15 * s))
            num_cols = max(12, w // col_spacing + 2)  # More columns
            for i in range(num_cols):
                x = i * col_spacing
                y = (frame * 4 + i * int(20 * s)) % h
                canvas.create_text(x, y, text=chars[(frame + i) % len(chars)],
                                 font=(MONO_FONT, max(8, int(10 * s))), fill="#00ff00")

        elif effect == "radar":
            angle = frame * 0.12
            r = int(25 * s)
            canvas.create_oval(cx - r, effect_y - int(18 * s), cx + r, effect_y + int(7 * s), outline=color, width=max(1, int(s)))
            x2 = cx + int(22 * s * math.cos(angle))
            y2 = effect_y - int(5 * s) + int(10 * s * math.sin(angle))
            canvas.create_line(cx, effect_y - int(5 * s), x2, y2, fill=color, width=max(2, int(2 * s)))

        elif effect == "fire":
            fire_y = h - int(8 * s)  # Very bottom
            for i in range(5):
                x = cx - int(40 * s) + i * int(20 * s)
                offset = int(5 * s * math.sin(frame * 0.4 + i))
                canvas.create_text(x, fire_y - offset, text="🔥", font=("Arial", font_md))

        elif effect == "confetti":
            conf = ["🎉", "🎊", "✨", "⭐", "💫"]
            num_conf = max(15, int(w / 15))  # More confetti
            for i in range(num_conf):
                x = (frame * 3 + i * int(22 * s)) % w
                y = (frame * 2 + i * int(18 * s)) % h
                canvas.create_text(x, y, text=conf[i % len(conf)], font=("Arial", max(10, int(11 * s))))

        elif effect == "lightning":
            if frame % 12 < 3:
                canvas.create_rectangle(0, 0, w, h, fill="", outline="#ffff00", width=max(3, int(4 * s)))

        elif effect == "glitch":
            if frame % 4 < 2:
                num_lines = max(6, h // int(25 * s))  # More glitch lines
                for i in range(num_lines):
                    y = int(20 * s) + i * int(22 * s)  # Spread across screen
                    offset = int(15 * s * math.sin(frame * 2 + i * 50))
                    canvas.create_line(0, y, w, y, fill="#ff0000", width=max(2, int(3 * s)))
                    canvas.create_line(offset, y + int(6 * s), w, y + int(6 * s), fill="#00ffff", width=max(2, int(3 * s)))

        elif effect == "orbit":
            for i in range(3):
                angle = frame * 0.1 + i * (2 * math.pi / 3)
                x = cx + int(65 * s * math.cos(angle))
                y = face_cy + int(45 * s * math.sin(angle))
                canvas.create_text(x, y, text="●", font=("Arial", font_lg), fill=color)

        elif effect == "soundwave":
            for i in range(7):
                x = cx - int(30 * s) + i * int(10 * s)
                amp = abs(math.sin(frame * 0.25 + i * 0.5)) * int(12 * s)
                canvas.create_line(x, effect_y - amp, x, effect_y + amp, fill=color, width=max(2, int(3 * s)))

        elif effect == "brainwave":
            for i in range(4):
                r = int((55 + i * 15) * s) + int(5 * s * math.sin(frame * 0.1 - i * 0.4))
                canvas.create_oval(cx - r, face_cy - int(r * 0.6), cx + r, face_cy + int(r * 0.6),
                                 outline=color, width=max(2, int(2 * s)))

        elif effect == "upload":
            for i in range(4):
                y = h - (frame * 5 + i * int(35 * s)) % h
                canvas.create_text(int(15 * s), y, text="▲", font=("Arial", font_md), fill=color)
                canvas.create_text(w - int(15 * s), y, text="▲", font=("Arial", font_md), fill=color)

        elif effect == "download":
            for i in range(4):
                y = (frame * 5 + i * int(35 * s)) % h
                canvas.create_text(int(15 * s), y, text="▼", font=("Arial", font_md), fill=color)
                canvas.create_text(w - int(15 * s), y, text="▼", font=("Arial", font_md), fill=color)

        elif effect == "typing":
            dots = "●" * ((frame // 8) % 4)
            canvas.create_text(cx, effect_y, text=dots.ljust(3), font=("Arial", font_md), fill=color)

        elif effect == "gear":
            spinner = "◐◓◑◒"[frame % 4]
            canvas.create_text(int(15 * s), face_cy, text=spinner, font=("Arial", font_lg), fill=color)
            canvas.create_text(w - int(15 * s), face_cy, text=spinner, font=("Arial", font_lg), fill=color)

        elif effect == "binary":
            num_bits = max(12, w // int(15 * s))  # More binary digits
            for i in range(num_bits):
                x = i * int(15 * s)
                y = (frame * 5 + i * int(15 * s)) % h
                canvas.create_text(x, y, text=str((frame + i) % 2), font=(MONO_FONT, max(8, int(10 * s))), fill="#00ff00")

        elif effect == "checkmarks":
            n = min((frame // 10) % 6, 5)
            for i in range(n):
                x = cx - int(40 * s) + i * int(20 * s)
                canvas.create_text(x, effect_y, text="✓", font=("Arial", font_md), fill="#00ff00")

        elif effect == "branch":
            lw = max(2, int(2 * s))
            canvas.create_line(cx - int(30 * s), effect_y, cx, effect_y, fill=color, width=lw)
            canvas.create_line(cx, effect_y, cx + int(25 * s), effect_y - int(10 * s), fill="#ff8800", width=lw)
            canvas.create_line(cx, effect_y, cx + int(25 * s), effect_y + int(10 * s), fill="#00ff88", width=lw)

        elif effect == "heart":
            pulse = 1 + 0.3 * abs(math.sin(frame * 0.2))
            size = int(24 * s * pulse)
            margin = int(25 * s)
            canvas.create_text(margin, face_cy, text="❤", font=("Arial", size), fill="#ff4466")
            canvas.create_text(w - margin, face_cy, text="❤", font=("Arial", size), fill="#ff4466")

        elif effect == "snow":
            num_flakes = max(18, int(w / 12))  # More snowflakes
            for i in range(num_flakes):
                x = (i * int(18 * s) + frame * 2) % w
                y = (frame * 2 + i * int(15 * s)) % h
                canvas.create_text(x, y, text="❄", font=("Arial", max(10, int(12 * s))), fill="#aaddff")

        elif effect == "rainbow":
            colors_list = ["#ff0000", "#ff8800", "#ffff00", "#00ff00", "#0088ff", "#8800ff"]
            lw = max(2, int(2 * s))
            for i, c in enumerate(colors_list):
                canvas.create_line(int(20 * s), effect_y + i * int(2 * s), w - int(20 * s), effect_y + i * int(2 * s), fill=c, width=lw)


# ═══════════════════════════════════════════════════════════════════════════════
# MAIN WINDOW
# ═══════════════════════════════════════════════════════════════════════════════

class MoltbotAvatar:
    MODES = {
        "robot": RobotRenderer,
        "face": FaceRenderer,
    }

    def __init__(self, mode: str = "robot"):
        self.state = AvatarState()
        self.running = True
        self.frame = 0

        self.mode_name = mode
        self.renderer = self.MODES.get(mode, RobotRenderer)()

        self.state_file = Path.home() / ".clawface" / "avatar_state.json"
        self.state_file.parent.mkdir(parents=True, exist_ok=True)

        # Resize/fullscreen state
        self.is_fullscreen = False
        self.saved_geometry = None
        self.min_w, self.min_h = 150, 120
        self.resize_edge = None  # Which edge/corner is being dragged

        self._setup_window()

        # Start threads
        threading.Thread(target=self._watch_state, daemon=True).start()
        threading.Thread(target=self._animate, daemon=True).start()

    def _setup_window(self):
        self.root = tk.Tk()
        self.root.title("Moltbot")
        self.root.overrideredirect(True)
        self.root.attributes("-topmost", True)
        self.root.attributes("-alpha", 0.95)

        # Size and position
        w, h = 220, 200
        screen_w = self.root.winfo_screenwidth()
        screen_h = self.root.winfo_screenheight()
        self.root.geometry(f"{w}x{h}+{screen_w - w - 20}+{screen_h - h - 80}")

        # Container with border for resize visual
        self.container = tk.Frame(self.root, bg="#1a1a1a")
        self.container.pack(fill=tk.BOTH, expand=True)

        # Mode bar with fullscreen button
        self.mode_bar = tk.Frame(self.container, bg="#111", height=20)
        self.mode_bar.pack(fill=tk.X)
        self.mode_bar.pack_propagate(False)

        for name in self.MODES.keys():
            btn = tk.Label(self.mode_bar, text=name[:3].upper(), font=(MONO_FONT, 8),
                          bg="#111", fg="#666", padx=5, cursor="hand2")
            btn.pack(side=tk.LEFT)
            btn.bind("<Button-1>", lambda e, n=name: self._switch_mode(n))

        # Fullscreen button on right
        fs_btn = tk.Label(self.mode_bar, text="⛶", font=("Arial", 10),
                         bg="#111", fg="#666", padx=5, cursor="hand2")
        fs_btn.pack(side=tk.RIGHT)
        fs_btn.bind("<Button-1>", lambda e: self._toggle_fullscreen())

        # Canvas
        self.canvas = tk.Canvas(self.container, width=220, height=140,
                               bg="#1a1a1a", highlightthickness=0)
        self.canvas.pack(fill=tk.BOTH, expand=True)

        # Message bar
        self.msg_bar = tk.Frame(self.container, bg="#111")
        self.msg_bar.pack(fill=tk.X)
        self.msg_label = tk.Label(self.msg_bar, text="", font=(MONO_FONT, 9),
                                 bg="#111", fg="#888", wraplength=200)
        self.msg_label.pack(pady=3)

        # Bindings for drag (move window)
        self.canvas.bind("<Button-1>", self._start_drag)
        self.canvas.bind("<B1-Motion>", self._drag)
        self.mode_bar.bind("<Button-1>", self._start_drag)
        self.mode_bar.bind("<B1-Motion>", self._drag)

        # Resize bindings on root edges
        self.root.bind("<Motion>", self._check_resize_cursor)
        self.root.bind("<ButtonPress-1>", self._start_resize)
        self.root.bind("<ButtonRelease-1>", self._stop_resize)
        self.root.bind("<B1-Motion>", self._do_resize)

        # Keyboard shortcuts
        self.root.bind("<Escape>", lambda e: self._handle_escape())
        self.root.bind("<q>", lambda e: self.quit())
        self.root.bind("<f>", lambda e: self._toggle_fullscreen())
        self.root.bind("<F11>", lambda e: self._toggle_fullscreen())

        # Double-click for fullscreen
        self.canvas.bind("<Double-Button-1>", lambda e: self._toggle_fullscreen())

    def _handle_escape(self):
        """Escape exits fullscreen first, then quits."""
        if self.is_fullscreen:
            self._toggle_fullscreen()
        else:
            self.quit()

    def _toggle_fullscreen(self):
        """Toggle fullscreen mode."""
        if self.is_fullscreen:
            # Restore from fullscreen
            self.is_fullscreen = False
            self.root.overrideredirect(True)
            self.root.attributes("-topmost", True)
            if self.saved_geometry:
                self.root.geometry(self.saved_geometry)
        else:
            # Go fullscreen
            self.saved_geometry = self.root.geometry()
            self.is_fullscreen = True
            # On macOS, use native fullscreen-like behavior
            screen_w = self.root.winfo_screenwidth()
            screen_h = self.root.winfo_screenheight()
            self.root.geometry(f"{screen_w}x{screen_h}+0+0")
            self.root.attributes("-topmost", False)  # Allow other windows in FS

    def _check_resize_cursor(self, e):
        """Change cursor when near edges for resize."""
        if self.is_fullscreen:
            self.root.config(cursor="")
            return

        x, y = e.x_root - self.root.winfo_x(), e.y_root - self.root.winfo_y()
        w, h = self.root.winfo_width(), self.root.winfo_height()
        edge = 8  # Edge detection zone

        # Determine edge
        on_left = x < edge
        on_right = x > w - edge
        on_top = y < edge
        on_bottom = y > h - edge

        if on_bottom and on_right:
            self.root.config(cursor="bottom_right_corner")
        elif on_bottom and on_left:
            self.root.config(cursor="bottom_left_corner")
        elif on_top and on_right:
            self.root.config(cursor="top_right_corner")
        elif on_top and on_left:
            self.root.config(cursor="top_left_corner")
        elif on_right:
            self.root.config(cursor="right_side")
        elif on_left:
            self.root.config(cursor="left_side")
        elif on_bottom:
            self.root.config(cursor="bottom_side")
        elif on_top:
            self.root.config(cursor="top_side")
        else:
            self.root.config(cursor="")

    def _start_resize(self, e):
        """Start resize if on edge."""
        if self.is_fullscreen:
            return

        x, y = e.x_root - self.root.winfo_x(), e.y_root - self.root.winfo_y()
        w, h = self.root.winfo_width(), self.root.winfo_height()
        edge = 8

        on_left = x < edge
        on_right = x > w - edge
        on_top = y < edge
        on_bottom = y > h - edge

        if on_bottom or on_right or on_top or on_left:
            self.resize_edge = {
                'left': on_left, 'right': on_right,
                'top': on_top, 'bottom': on_bottom
            }
            self._resize_start_x = e.x_root
            self._resize_start_y = e.y_root
            self._resize_start_w = w
            self._resize_start_h = h
            self._resize_start_geo_x = self.root.winfo_x()
            self._resize_start_geo_y = self.root.winfo_y()
        else:
            self.resize_edge = None

    def _stop_resize(self, e):
        """Stop resize."""
        self.resize_edge = None

    def _do_resize(self, e):
        """Perform resize based on drag."""
        if not self.resize_edge or self.is_fullscreen:
            return

        dx = e.x_root - self._resize_start_x
        dy = e.y_root - self._resize_start_y

        new_w = self._resize_start_w
        new_h = self._resize_start_h
        new_x = self._resize_start_geo_x
        new_y = self._resize_start_geo_y

        if self.resize_edge['right']:
            new_w = max(self.min_w, self._resize_start_w + dx)
        if self.resize_edge['left']:
            new_w = max(self.min_w, self._resize_start_w - dx)
            new_x = self._resize_start_geo_x + (self._resize_start_w - new_w)
        if self.resize_edge['bottom']:
            new_h = max(self.min_h, self._resize_start_h + dy)
        if self.resize_edge['top']:
            new_h = max(self.min_h, self._resize_start_h - dy)
            new_y = self._resize_start_geo_y + (self._resize_start_h - new_h)

        self.root.geometry(f"{new_w}x{new_h}+{new_x}+{new_y}")

        # Update message wraplength
        self.msg_label.config(wraplength=new_w - 20)

    def _switch_mode(self, name: str):
        if name in self.MODES:
            self.mode_name = name
            self.renderer = self.MODES[name]()

    def _start_drag(self, e):
        self._drag_x, self._drag_y = e.x, e.y

    def _drag(self, e):
        x = self.root.winfo_x() + e.x - self._drag_x
        y = self.root.winfo_y() + e.y - self._drag_y
        self.root.geometry(f"+{x}+{y}")

    def _watch_state(self):
        last_mtime = 0
        while self.running:
            try:
                if self.state_file.exists():
                    mtime = self.state_file.stat().st_mtime
                    if mtime > last_mtime:
                        last_mtime = mtime
                        with open(self.state_file) as f:
                            data = json.load(f)
                            self.state = AvatarState.from_dict(data)
                            self.root.after(0, self._update_message)
            except:
                pass
            time.sleep(0.1)

    def _update_message(self):
        if self.state.message:
            self.msg_label.config(text=self.state.message)
        else:
            self.msg_label.config(text="")

    def _animate(self):
        while self.running:
            self.frame += 1
            try:
                self.root.after(0, self._render)
            except:
                pass
            time.sleep(0.1)

    def _render(self):
        self.canvas.delete("all")
        # Use actual canvas size for responsive rendering
        w = self.canvas.winfo_width()
        h = self.canvas.winfo_height()
        if w < 10 or h < 10:  # Not yet realized
            w, h = 220, 140
        self.renderer.render(self.canvas, self.state, self.frame, w, h)

        # Scale message font based on canvas size
        scale = get_scale(w, h)
        msg_font_size = max(9, int(9 * scale))
        self.msg_label.config(font=(MONO_FONT, msg_font_size), wraplength=max(100, w - 20))

    def quit(self):
        self.running = False
        self.root.quit()

    def run(self):
        self.root.mainloop()


# ═══════════════════════════════════════════════════════════════════════════════
# CLI
# ═══════════════════════════════════════════════════════════════════════════════

def set_state(emotion="neutral", action="idle", effect="none", message="", subagents=None):
    """Helper to set avatar state from code/CLI."""
    state_file = Path.home() / ".clawface" / "avatar_state.json"
    state_file.parent.mkdir(parents=True, exist_ok=True)

    data = {
        "emotion": emotion,
        "action": action,
        "effect": effect,
        "message": message,
        "timestamp": time.time()
    }
    if subagents:
        data["subagents"] = subagents

    with open(state_file, 'w') as f:
        json.dump(data, f)


def run_demo():
    """Demo mode - cycle through random states every 5 seconds."""
    import random

    # Demo scenarios: (emotion, action, effect, message)
    DEMO_SCENARIOS = [
        ("neutral", "idle", "none", "Czekam na zadanie..."),
        ("thinking", "thinking", "brainwave", "Hmm, zastanawiam się..."),
        ("thinking", "searching", "radar", "Szukam pliku config.yaml..."),
        ("happy", "reading", "matrix", "Czytam kod źródłowy..."),
        ("excited", "coding", "fire", "Jestem w strefie! Piszę kod..."),
        ("happy", "coding", "progressbar:30", "Implementuję feature..."),
        ("happy", "coding", "progressbar:60", "Już połowa zrobiona!"),
        ("happy", "coding", "progressbar:90", "Prawie gotowe..."),
        ("neutral", "loading", "gear", "Instaluję dependencies..."),
        ("thinking", "loading", "binary", "Kompiluję projekt..."),
        ("neutral", "loading", "orbit", "Przetwarzam dane..."),
        ("happy", "speaking", "soundwave", "Generuję odpowiedź..."),
        ("neutral", "loading", "checkmarks", "Uruchamiam testy..."),
        ("excited", "success", "confetti", "Wszystkie testy przeszły!"),
        ("proud", "success", "sparkles", "Deploy na produkcję!"),
        ("excited", "idle", "rainbow", "Wszystko działa idealnie!"),
        ("proud", "success", "lightning", "Zrobione w 5 sekund!"),
        ("neutral", "loading", "branch", "Git push origin main..."),
        ("neutral", "loading", "upload", "Wysyłam pliki..."),
        ("neutral", "loading", "download", "Pobieram zależności..."),
        ("tired", "reading", "none", "Czytam dokumentację..."),
        ("confused", "thinking", "pulse", "Co tu się dzieje...?"),
        ("angry", "error", "glitch", "Segmentation fault!"),
        ("sad", "error", "none", "Build failed :("),
        ("thinking", "thinking", "typing", "Piszę commit message..."),
        ("happy", "idle", "heart", "System healthy!"),
        ("neutral", "loading", "snow", "Czyszczę cache..."),
    ]

    print("🦞 DEMO MODE - Losowe stany co 5 sekund")
    print("=" * 50)
    print("Naciśnij Ctrl+C aby zatrzymać")
    print("=" * 50)
    print()

    try:
        while True:
            scenario = random.choice(DEMO_SCENARIOS)
            emotion, action, effect, message = scenario

            # Randomly add subagents (50% chance)
            subagents = None
            if random.random() > 0.5:
                total = random.randint(1, 5)
                running = random.randint(0, total)
                remaining = total - running
                success = random.randint(0, remaining)
                remaining -= success
                error = random.randint(0, remaining)
                remaining -= error
                timeout = random.randint(0, remaining)
                unknown = remaining - timeout
                subagents = {
                    "running": running,
                    "success": success,
                    "error": error,
                    "timeout": timeout,
                    "unknown": unknown
                }

            # Set the state
            set_state(emotion, action, effect, message, subagents)

            # Pretty print to terminal
            emo_info = EMOTIONS.get(emotion, {})
            action_info = ACTIONS.get(action, {})

            print(f"┌{'─' * 48}┐")
            print(f"│ {'EMOTION:':<10} {emotion:<15} {emo_info.get('emoji', ''):>20} │")
            print(f"│ {'ACTION:':<10} {action:<15} [{action_info.get('label', '')}]{' ' * (14 - len(action_info.get('label', '')))} │")
            print(f"│ {'EFFECT:':<10} {effect:<36} │")
            print(f"│ {'MESSAGE:':<10} {message[:34]:<36} │")
            if subagents:
                sub_str = f"⏳{subagents['running']} ✅{subagents['success']} ❌{subagents['error']} ⏱️{subagents['timeout']} ❓{subagents['unknown']}"
                print(f"│ {'SUBAGENTS:':<10} {sub_str:<36} │")
            print(f"└{'─' * 48}┘")
            print()

            time.sleep(5)

    except KeyboardInterrupt:
        print("\n👋 Demo zakończone!")
        set_state("neutral", "idle", "none", "")


def main():
    import argparse

    parser = argparse.ArgumentParser(description="Moltbot Avatar v3")
    parser.add_argument("--mode", choices=["robot", "face"],
                       default="robot", help="Display mode")
    parser.add_argument("--demo", action="store_true",
                       help="Run demo mode - random states every 5 seconds")

    # State setting mode
    parser.add_argument("--set", action="store_true", help="Set state and exit")
    parser.add_argument("--emotion", default="neutral",
                       choices=list(EMOTIONS.keys()))
    parser.add_argument("--action", default="idle",
                       choices=list(ACTIONS.keys()))
    parser.add_argument("--effect", default="none",
                       help="Effect: none, sparkles, pulse, progressbar:XX, matrix, radar, etc.")
    parser.add_argument("--message", "-m", default="", help="Message to display")

    args = parser.parse_args()

    if args.demo:
        run_demo()
        return

    if args.set:
        set_state(args.emotion, args.action, args.effect, args.message)
        print(f"State set: {args.emotion}/{args.action}/{args.effect}")
        if args.message:
            print(f"Message: {args.message}")
        return

    print("🦞 Moltbot Avatar v3")
    print(f"   Mode: {args.mode}")
    print("   Drag to move | Q/Esc to quit")
    print(f"   State file: ~/.clawface/avatar_state.json")
    print()
    print("   Tip: Run with --demo in another terminal to see all states!")

    avatar = MoltbotAvatar(mode=args.mode)
    try:
        avatar.run()
    except KeyboardInterrupt:
        avatar.quit()


if __name__ == "__main__":
    main()
