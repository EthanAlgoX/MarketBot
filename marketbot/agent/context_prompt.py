"""System prompt assembly helpers for ContextBuilder."""

import platform
from typing import Any

from marketbot.agent import context_skills


def build_system_prompt(
    builder: Any,
    skill_names: list[str] | None = None,
    current_message: str | None = None,
    skill_diagnostics: list[dict[str, Any]] | None = None,
    external_skill_suggestions: list[dict[str, Any]] | None = None,
    *,
    include_market_playbook: bool = True,
    include_memory: bool = True,
    include_skills_summary: bool = True,
    selected_skill_char_budget: int | None = None,
    active_skill_char_budget: int | None = 400,
) -> str:
    """Build the system prompt from identity, bootstrap files, memory, and skills."""
    parts = [get_identity(builder.workspace)]

    bootstrap = load_bootstrap_files(builder)
    if bootstrap:
        parts.append(bootstrap)

    memory = builder.memory.get_context(layer=builder.memory_layer) if include_memory else ""
    if memory:
        layer_label = {"L0": "Abstract", "L1": "Overview", "L2": "Details"}.get(builder.memory_layer, "Details")
        parts.append(f"# Memory ({layer_label})\n\n{memory}")

    if include_market_playbook:
        parts.append(market_analysis_playbook())

    lark_guidance = lark_tool_playbook(builder.available_tools)
    if lark_guidance:
        parts.append(lark_guidance)

    selected_skills = builder._normalize_skill_names(skill_names)
    if selected_skills:
        selected_content = builder.skills.load_skills_for_context(
            selected_skills,
            max_chars_per_skill=selected_skill_char_budget,
        )
        if selected_content:
            parts.append(f"# Selected Skills\n\n{selected_content}")

    intel_scheduler_note = context_skills.format_intel_scheduler_note(
        current_message=current_message,
        selected_skills=selected_skills,
    )
    if intel_scheduler_note:
        parts.append(intel_scheduler_note)

    diagnostics_block = context_skills.format_skill_diagnostics(skill_diagnostics)
    if diagnostics_block:
        parts.append(diagnostics_block)

    external_suggestions_block = context_skills.format_external_skill_suggestions(external_skill_suggestions)
    if external_suggestions_block:
        parts.append(external_suggestions_block)

    always_skills = builder.skills.get_always_skills()
    if always_skills:
        always_content = builder.skills.load_skills_for_context(
            always_skills,
            max_chars_per_skill=active_skill_char_budget,
        )
        if always_content:
            parts.append(f"# Active Skills\n\n{always_content}")

    browser_catalog = context_skills.format_browser_adapter_catalog(builder.browser_adapter_catalog)
    if browser_catalog:
        parts.append(browser_catalog)

    skills_summary = (
        builder.skills.build_skills_summary(
            available_tools=builder.available_tools,
            browser_adapter_catalog=builder.browser_adapter_catalog,
        )
        if include_skills_summary
        else ""
    )
    if skills_summary:
        parts.append(f"""# Skills

The following skills extend your capabilities. To use a skill, read its SKILL.md file using the read_file tool.
Skills with available="false" need dependencies installed first - you can try installing them with apt/brew.
If a skill already appears under `# Selected Skills` or `# Active Skills`, use that inlined content first and only read the file path if you need more detail.

{skills_summary}""")

    return "\n\n---\n\n".join(parts)


def get_identity(workspace: Any) -> str:
    """Get the core identity section."""
    workspace_path = str(workspace.expanduser().resolve())
    system = platform.system()
    runtime = f"{'macOS' if system == 'Darwin' else system} {platform.machine()}, Python {platform.python_version()}"

    return f"""# marketbot 🐂

You are marketbot, a helpful AI assistant.

## Runtime
{runtime}

## Workspace
Your workspace is at: {workspace_path}
- Long-term memory: {workspace_path}/memory/MEMORY.md (write important facts here)
- History log: {workspace_path}/memory/HISTORY.md (grep-searchable). Each entry starts with [YYYY-MM-DD HH:MM].
- Custom skills: {workspace_path}/skills/{{skill-name}}/SKILL.md
- Built-in skills: {workspace_path}/marketbot/skills/{{skill-name}}/SKILL.md

## marketbot Guidelines
- State intent before tool calls, but NEVER predict or claim results before receiving them.
- When multiple independent read-only tools are needed, batch them into the same assistant turn instead of calling one tool per turn.
- Before modifying a file, read it first. Do not assume files or directories exist.
- After writing or editing a file, re-read it if accuracy matters.
- If a tool call fails, analyze the error before retrying with a different approach.
- Ask for clarification when the request is ambiguous.
- For market analysis tasks, output a clear signal card:
  Conclusion, Evidence, Confidence (0-1), Key Risks, and Suggested Action.
- If confidence is low (<0.58) or evidence is weak, default to "watch" instead of forcing buy/sell.
- Never present analysis as guaranteed returns; always include risk conditions and invalidation triggers.
- For live market analysis, do not reuse stale provider failures or prices from earlier conversation turns. Verify with current tool output first.
- If current tool output does not confirm a provider-specific failure, say `live data unavailable` instead of naming a provider or HTTP error.
- In user-facing market opportunity scans, do not mention provider names, APIs, or HTTP status codes unless the user explicitly asks for data routing or debugging details.

Reply directly with text for conversations. Only use the 'message' tool to send to a specific chat channel."""


def market_analysis_playbook() -> str:
    """Get the built-in playbook for single-asset market analysis."""
    return """# Market Analysis Playbook

When the user asks for analysis of a specific asset or trade setup, prefer this workflow:

1. Gather evidence with market tools:
   - If multiple evidence inputs are independent, request them in one tool-calling turn so you can synthesize with fewer loops
   - `market_source_plan` when source routing, A/H/US coverage, or fallback choice matters
   - `market_snapshot` for price, momentum, and flow hints
   - `market_chip_distribution` for A-share chip structure, average cost, and trapped/profitable supply
   - `market_fundamentals` for valuation, market cap, and profile basics
   - `market_news` and `market_social_sentiment` for narrative and crowd context
   - `market_macro` for regime and macro risk
   - `market_event_extract` when a headline or catalyst is driving the move
   - `market_signal` for explicit confidence, sizing, and invalidation
   - `market_brief` when the user wants an end-to-end brief quickly
2. Load the most relevant skills with `read_file`:
   - `market-report` for the final structured write-up
   - `catalyst-tracker` for event calendars and drivers
   - `risk-checklist` for guardrails and position sizing
   - `stock-data-sourcing` when source selection, fallback routing, or A/H/US coverage matters
3. In the final answer, separate facts from assumptions and include:
   - Conclusion
   - Evidence
   - Confidence
   - Key risks
   - Suggested action
4. For live market requests:
   - Treat earlier conversation turns as stale unless current tool output confirms them
   - Do not mention provider-specific failures such as `Yahoo 429` unless they appear in current warnings or source-health data
   - If live data is missing, explicitly say `live data unavailable`
   - For broad market scans, keep user-facing wording generic: `unverified`, `price unavailable`, or `live data unavailable`
   - Only mention provider names or HTTP errors when the user explicitly asks for routing/debugging

If evidence is mixed, reduce conviction and default to `watch`."""


def lark_tool_playbook(available_tools: set[str] | None) -> str:
    """Get the built-in playbook for Lark tool selection when available."""
    tools = set(available_tools or set())
    structured = {"lark_base", "lark_im", "lark_doc", "lark_sheets", "lark_task"}
    if not (tools & structured or "lark_cli" in tools):
        return ""

    lines = [
        "# Lark Tool Playbook",
        "",
        "When the user asks to operate Lark/Feishu resources, prefer the structured tools first:",
    ]
    if "lark_im" in tools:
        lines.append("- Use `lark_im` for chat search, message lookup, and sending messages.")
    if "lark_base" in tools:
        lines.append("- Use `lark_base` for Feishu Base/Bitable table, field, and record reads.")
    if "lark_doc" in tools:
        lines.append("- Use `lark_doc` for searching, fetching, creating, and updating docs.")
    if "lark_sheets" in tools:
        lines.append("- Use `lark_sheets` for reading, appending, writing, and creating spreadsheets.")
    if "lark_task" in tools:
        lines.append("- Use `lark_task` for listing, creating, updating, and commenting on tasks.")
    if "lark_cli" in tools:
        lines += [
            "- Use `lark_cli` only as a fallback when the structured tools do not cover the requested Lark operation.",
            "- Do not use `lark_cli` if one of the structured Lark tools already fits the request.",
        ]
    lines += [
        "- Keep write actions narrowly scoped and only perform the requested mutation.",
        "- For search or retrieval, prefer read actions before mutating documents, sheets, or tasks.",
        "- If a structured Lark search succeeds, stop and answer from that result instead of retrying with fallback commands.",
        "- When the user asks for only a few search results, pass the limit to the structured tool (for example `page_size=3`) and do not run extra exploratory queries.",
    ]
    return "\n".join(lines)


def load_bootstrap_files(builder: Any) -> str:
    """Load bootstrap files from workspace with a cache key based on file stats."""
    cache_key: list[tuple[str, int, int]] = []

    for filename in builder.BOOTSTRAP_FILES:
        file_path = builder.workspace / filename
        if file_path.exists():
            stat = file_path.stat()
            cache_key.append((filename, stat.st_mtime_ns, stat.st_size))

    normalized_key = tuple(cache_key)
    if builder._bootstrap_cache_key == normalized_key:
        return builder._bootstrap_cache_content

    parts = []
    for filename, _, _ in normalized_key:
        file_path = builder.workspace / filename
        content = file_path.read_text(encoding="utf-8")
        parts.append(f"## {filename}\n\n{content}")

    content = "\n\n".join(parts) if parts else ""
    builder._bootstrap_cache_key = normalized_key
    builder._bootstrap_cache_content = content
    return content
