#!/usr/bin/env python3
"""
Moltbot Avatar API - Simple interface for agents to control the avatar.

Usage from Python:
    from avatar_api import Avatar

    avatar = Avatar()
    avatar.set(emotion="happy", action="coding", message="Writing tests...")
    avatar.progress(50, message="Halfway there!")
    avatar.success("All tests pass!")
    avatar.error("Build failed")

Usage from CLI:
    python3 avatar_api.py happy coding "Implementing feature..."
    python3 avatar_api.py --progress 75 --message "Almost done..."
    python3 avatar_api.py --success "Completed!"
    python3 avatar_api.py --error "Something went wrong"
"""

import json
import time
from pathlib import Path
from typing import Optional


class Avatar:
    """
    Simple API to control the Moltbot avatar.

    Emotions: neutral, happy, excited, thinking, confused, tired, angry, sad, proud
    Actions: idle, coding, searching, reading, loading, speaking, success, error, thinking

    Effects:
        none        - No effect
        sparkles    - Floating sparkles
        pulse       - Pulsing outline
        progressbar:XX - Progress bar (0-100)
        matrix      - Falling code chars (reading code)
        radar       - Scanning sweep (searching)
        fire        - Flames (intense work)
        confetti    - Celebration (big success)
        lightning   - Flash (quick action)
        glitch      - Distortion (error)
        orbit       - Spinning elements (loading)
        soundwave   - Audio bars (speaking)
        brainwave   - Pulsing waves (deep thinking)
        upload      - Arrows up (sending)
        download    - Arrows down (receiving)
        typing      - Animated dots (writing)
        gear        - Spinning gear (installing)
        binary      - 0s and 1s (compiling)
        checkmarks  - Appearing checks (testing)
        branch      - Git branches (version control)
        heart       - Beating heart (health check)
        snow        - Falling snow (cleanup)
        rainbow     - Rainbow colors (everything great!)
    """

    STATE_FILE = Path.home() / ".clawface" / "avatar_state.json"

    def __init__(self):
        self.STATE_FILE.parent.mkdir(parents=True, exist_ok=True)

    def set(self,
            emotion: str = "neutral",
            action: str = "idle",
            effect: str = "none",
            message: str = "",
            subagents = None) -> None:
        """Set avatar state directly.

        subagents can be:
          - int: simple count of active subagents
          - dict: {"active": N, "done": N, "failed": N}
        """
        data = {
            "emotion": emotion,
            "action": action,
            "effect": effect,
            "message": message,
            "timestamp": time.time()
        }
        if subagents:
            data["subagents"] = subagents
        self._write(data)

    def set_subagents(self, running: int = 0, success: int = 0,
                       error: int = 0, timeout: int = 0, unknown: int = 0) -> None:
        """Update subagent counts (reads current state first).

        Statuses per Claude Code Task tool:
        - running: currently executing
        - success: completed successfully
        - error: failed with error
        - timeout: timed out
        - unknown: unknown outcome
        """
        current = {}
        if self.STATE_FILE.exists():
            try:
                with open(self.STATE_FILE) as f:
                    current = json.load(f)
            except:
                pass
        current["subagents"] = {
            "running": running,
            "success": success,
            "error": error,
            "timeout": timeout,
            "unknown": unknown
        }
        current["timestamp"] = time.time()
        self._write(current)

    def _write(self, data: dict) -> None:
        with open(self.STATE_FILE, 'w') as f:
            json.dump(data, f)

    # ─────────────────────────────────────────────────────────────────────────
    # Convenience methods
    # ─────────────────────────────────────────────────────────────────────────

    def idle(self, message: str = "") -> None:
        """Set to idle/standby."""
        self.set("neutral", "idle", "none", message)

    def thinking(self, message: str = "") -> None:
        """Show thinking state."""
        self.set("thinking", "thinking", "pulse", message)

    def coding(self, message: str = "", progress: Optional[int] = None) -> None:
        """Show coding state with optional progress."""
        effect = f"progressbar:{progress}" if progress is not None else "none"
        self.set("happy", "coding", effect, message)

    def searching(self, message: str = "") -> None:
        """Show searching state."""
        self.set("thinking", "searching", "pulse", message)

    def reading(self, message: str = "") -> None:
        """Show reading state."""
        self.set("neutral", "reading", "none", message)

    def loading(self, message: str = "", progress: Optional[int] = None) -> None:
        """Show loading state with optional progress."""
        effect = f"progressbar:{progress}" if progress is not None else "pulse"
        self.set("neutral", "loading", effect, message)

    def speaking(self, message: str = "") -> None:
        """Show speaking/output state."""
        self.set("happy", "speaking", "none", message)

    def progress(self, percent: int, message: str = "",
                 action: str = "loading", emotion: str = "neutral") -> None:
        """Show progress bar."""
        self.set(emotion, action, f"progressbar:{percent}", message)

    def success(self, message: str = "") -> None:
        """Show success state with sparkles!"""
        self.set("excited", "success", "sparkles", message)

    def error(self, message: str = "") -> None:
        """Show error state."""
        self.set("angry", "error", "none", message)

    def frustrated(self, message: str = "") -> None:
        """Show frustrated state."""
        self.set("angry", "thinking", "none", message)

    def proud(self, message: str = "") -> None:
        """Show proud state."""
        self.set("proud", "idle", "sparkles", message)

    def tired(self, message: str = "") -> None:
        """Show tired state."""
        self.set("tired", "idle", "none", message)

    def confused(self, message: str = "") -> None:
        """Show confused state."""
        self.set("confused", "thinking", "pulse", message)

    # ─────────────────────────────────────────────────────────────────────────
    # Scenario-based methods (with appropriate effects)
    # ─────────────────────────────────────────────────────────────────────────

    def analyzing_code(self, message: str = "") -> None:
        """Reading/analyzing code - matrix effect."""
        self.set("thinking", "reading", "matrix", message)

    def deep_search(self, message: str = "") -> None:
        """Searching files - radar effect."""
        self.set("thinking", "searching", "radar", message)

    def intense_coding(self, message: str = "") -> None:
        """Intense coding session - fire effect."""
        self.set("excited", "coding", "fire", message)

    def big_success(self, message: str = "") -> None:
        """Major success - confetti celebration!"""
        self.set("excited", "success", "confetti", message)

    def quick_win(self, message: str = "") -> None:
        """Quick successful action - lightning."""
        self.set("proud", "success", "lightning", message)

    def crash(self, message: str = "") -> None:
        """Error/crash - glitch effect."""
        self.set("angry", "error", "glitch", message)

    def processing(self, message: str = "") -> None:
        """Processing/loading - orbit effect."""
        self.set("neutral", "loading", "orbit", message)

    def outputting(self, message: str = "") -> None:
        """Generating output - soundwave effect."""
        self.set("happy", "speaking", "soundwave", message)

    def deep_thinking(self, message: str = "") -> None:
        """Deep analysis - brainwave effect."""
        self.set("thinking", "thinking", "brainwave", message)

    def uploading(self, message: str = "", progress: Optional[int] = None) -> None:
        """Uploading/sending data."""
        effect = f"progressbar:{progress}" if progress else "upload"
        self.set("neutral", "loading", effect, message)

    def downloading(self, message: str = "", progress: Optional[int] = None) -> None:
        """Downloading/receiving data."""
        effect = f"progressbar:{progress}" if progress else "download"
        self.set("neutral", "loading", effect, message)

    def writing(self, message: str = "") -> None:
        """Writing/typing content."""
        self.set("happy", "coding", "typing", message)

    def installing(self, message: str = "") -> None:
        """Installing packages."""
        self.set("neutral", "loading", "gear", message)

    def compiling(self, message: str = "") -> None:
        """Compiling code."""
        self.set("thinking", "loading", "binary", message)

    def testing(self, message: str = "") -> None:
        """Running tests - checkmarks effect."""
        self.set("thinking", "loading", "checkmarks", message)

    def git_operation(self, message: str = "") -> None:
        """Git operation - branch effect."""
        self.set("neutral", "loading", "branch", message)

    def health_check(self, message: str = "") -> None:
        """Health check - heart effect."""
        self.set("happy", "idle", "heart", message)

    def cleanup(self, message: str = "") -> None:
        """Cleanup/maintenance - snow effect."""
        self.set("neutral", "loading", "snow", message)

    def everything_great(self, message: str = "") -> None:
        """Everything is awesome - rainbow effect."""
        self.set("excited", "idle", "rainbow", message)


# ═══════════════════════════════════════════════════════════════════════════════
# CLI INTERFACE
# ═══════════════════════════════════════════════════════════════════════════════

def main():
    import argparse

    parser = argparse.ArgumentParser(
        description="Control Moltbot avatar from CLI",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  # Quick states
  avatar_api.py --success "Build complete!"
  avatar_api.py --error "Tests failed"
  avatar_api.py --progress 50 --message "Halfway done"

  # Scenario shortcuts
  avatar_api.py --analyze "Reading codebase..."    # matrix effect
  avatar_api.py --search "Finding config..."       # radar effect
  avatar_api.py --intense "In the zone!"          # fire effect
  avatar_api.py --celebrate "Shipped v2.0!"       # confetti effect
  avatar_api.py --install "Installing deps..."     # gear effect
  avatar_api.py --compile "Building..."            # binary effect
  avatar_api.py --test "Running tests..."          # checkmarks effect
  avatar_api.py --git "Pushing to main..."         # branch effect

  # Full control
  avatar_api.py happy coding "Writing tests..." -e fire
  avatar_api.py thinking searching "Looking..." -e radar
        """
    )

    # Quick shortcuts
    parser.add_argument("--success", metavar="MSG", help="Success with sparkles")
    parser.add_argument("--error", metavar="MSG", help="Error state")
    parser.add_argument("--crash", metavar="MSG", help="Crash with glitch effect")
    parser.add_argument("--progress", type=int, metavar="N", help="Progress bar (0-100)")
    parser.add_argument("--thinking", metavar="MSG", help="Thinking with pulse")
    parser.add_argument("--coding", metavar="MSG", help="Coding state")
    parser.add_argument("--loading", metavar="MSG", help="Loading with orbit")
    parser.add_argument("--idle", action="store_true", help="Idle state")

    # Scenario shortcuts (with effects)
    parser.add_argument("--analyze", metavar="MSG", help="Analyzing code (matrix effect)")
    parser.add_argument("--search", metavar="MSG", help="Searching (radar effect)")
    parser.add_argument("--intense", metavar="MSG", help="Intense coding (fire effect)")
    parser.add_argument("--celebrate", metavar="MSG", help="Big success (confetti)")
    parser.add_argument("--quick", metavar="MSG", help="Quick win (lightning)")
    parser.add_argument("--install", metavar="MSG", help="Installing (gear effect)")
    parser.add_argument("--compile", metavar="MSG", help="Compiling (binary effect)")
    parser.add_argument("--test", metavar="MSG", help="Testing (checkmarks)")
    parser.add_argument("--git", metavar="MSG", help="Git operation (branch)")
    parser.add_argument("--upload", metavar="MSG", help="Uploading (arrows up)")
    parser.add_argument("--download", metavar="MSG", help="Downloading (arrows down)")
    parser.add_argument("--output", metavar="MSG", help="Outputting (soundwave)")
    parser.add_argument("--deep", metavar="MSG", help="Deep thinking (brainwave)")
    parser.add_argument("--rainbow", metavar="MSG", help="Everything great! (rainbow)")

    # Full control
    parser.add_argument("emotion", nargs="?", default=None,
                       help="Emotion: neutral, happy, excited, thinking, confused, tired, angry, sad, proud")
    parser.add_argument("action", nargs="?", default=None,
                       help="Action: idle, coding, searching, reading, loading, speaking, success, error, thinking")
    parser.add_argument("message", nargs="?", default="",
                       help="Message to display")
    parser.add_argument("--effect", "-e", default="none",
                       help="Effect: sparkles, pulse, matrix, radar, fire, confetti, lightning, glitch, orbit, etc.")

    # Subagent tracking (statuses per Claude Code Task tool)
    parser.add_argument("--subagents", "-s", type=int, default=0,
                       help="Number of running subagents (simple count)")
    parser.add_argument("--sub-running", type=int, default=0, help="Running subagents")
    parser.add_argument("--sub-success", type=int, default=0, help="Successful subagents")
    parser.add_argument("--sub-error", type=int, default=0, help="Failed subagents (error)")
    parser.add_argument("--sub-timeout", type=int, default=0, help="Timed out subagents")
    parser.add_argument("--sub-unknown", type=int, default=0, help="Unknown status subagents")

    args = parser.parse_args()
    avatar = Avatar()

    # Handle shortcuts first (in priority order)
    if args.success:
        avatar.success(args.success)
        print(f"✅ {args.success}")
    elif args.error:
        avatar.error(args.error)
        print(f"❌ {args.error}")
    elif args.crash:
        avatar.crash(args.crash)
        print(f"💥 {args.crash}")
    elif args.progress is not None:
        msg = getattr(args, 'message', "") or ""
        avatar.progress(args.progress, msg)
        print(f"📊 Progress: {args.progress}%")
    elif args.thinking:
        avatar.thinking(args.thinking)
        print(f"🤔 {args.thinking}")
    elif args.coding:
        avatar.coding(args.coding)
        print(f"💻 {args.coding}")
    elif args.loading:
        avatar.processing(args.loading)
        print(f"⏳ {args.loading}")
    elif args.idle:
        avatar.idle()
        print("🦞 Idle")

    # Scenario shortcuts
    elif args.analyze:
        avatar.analyzing_code(args.analyze)
        print(f"📖 {args.analyze}")
    elif args.search:
        avatar.deep_search(args.search)
        print(f"🔍 {args.search}")
    elif args.intense:
        avatar.intense_coding(args.intense)
        print(f"🔥 {args.intense}")
    elif args.celebrate:
        avatar.big_success(args.celebrate)
        print(f"🎉 {args.celebrate}")
    elif args.quick:
        avatar.quick_win(args.quick)
        print(f"⚡ {args.quick}")
    elif args.install:
        avatar.installing(args.install)
        print(f"⚙️ {args.install}")
    elif args.compile:
        avatar.compiling(args.compile)
        print(f"🔢 {args.compile}")
    elif args.test:
        avatar.testing(args.test)
        print(f"✓ {args.test}")
    elif args.git:
        avatar.git_operation(args.git)
        print(f"🌿 {args.git}")
    elif args.upload:
        avatar.uploading(args.upload)
        print(f"⬆️ {args.upload}")
    elif args.download:
        avatar.downloading(args.download)
        print(f"⬇️ {args.download}")
    elif args.output:
        avatar.outputting(args.output)
        print(f"🔊 {args.output}")
    elif args.deep:
        avatar.deep_thinking(args.deep)
        print(f"🧠 {args.deep}")
    elif args.rainbow:
        avatar.everything_great(args.rainbow)
        print(f"🌈 {args.rainbow}")

    elif args.emotion and args.action:
        # Full control mode
        # Build subagents value (per Claude Code Task tool statuses)
        subagents = None
        if args.sub_running or args.sub_success or args.sub_error or args.sub_timeout or args.sub_unknown:
            subagents = {
                "running": args.sub_running,
                "success": args.sub_success,
                "error": args.sub_error,
                "timeout": args.sub_timeout,
                "unknown": args.sub_unknown
            }
        elif args.subagents:
            subagents = args.subagents  # Simple int count

        avatar.set(args.emotion, args.action, args.effect, args.message, subagents)
        print(f"Set: {args.emotion}/{args.action}/{args.effect}")
        if subagents:
            print(f"Subagents: {subagents}")
        if args.message:
            print(f"Message: {args.message}")
    else:
        parser.print_help()


if __name__ == "__main__":
    main()
