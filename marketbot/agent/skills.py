"""Skills loader for agent capabilities."""

import json
import os
import re
import shutil
from pathlib import Path

from marketbot.domain.market.profile import freshness_satisfies

# Default builtin skills directory (relative to this file)
BUILTIN_SKILLS_DIR = Path(__file__).parent.parent / "skills"


class SkillsLoader:
    """
    Loader for agent skills.

    Skills are markdown files (SKILL.md) that teach the agent how to use
    specific tools or perform certain tasks.
    """

    def __init__(self, workspace: Path, builtin_skills_dir: Path | None = None):
        self.workspace = workspace
        self.workspace_skills = workspace / "skills"
        self.builtin_skills = builtin_skills_dir or BUILTIN_SKILLS_DIR

    def list_skills(self, filter_unavailable: bool = True, available_tools: set[str] | None = None) -> list[dict[str, str]]:
        """
        List all available skills.

        Args:
            filter_unavailable: If True, filter out skills with unmet requirements.

        Returns:
            List of skill info dicts with 'name', 'path', 'source'.
        """
        skills = []

        # Workspace skills (highest priority)
        if self.workspace_skills.exists():
            for skill_dir in self.workspace_skills.iterdir():
                if skill_dir.is_dir():
                    skill_file = skill_dir / "SKILL.md"
                    if skill_file.exists():
                        skills.append({"name": skill_dir.name, "path": str(skill_file), "source": "workspace"})

        # Built-in skills
        if self.builtin_skills and self.builtin_skills.exists():
            for skill_dir in self.builtin_skills.iterdir():
                if skill_dir.is_dir():
                    skill_file = skill_dir / "SKILL.md"
                    if skill_file.exists() and not any(s["name"] == skill_dir.name for s in skills):
                        skills.append({"name": skill_dir.name, "path": str(skill_file), "source": "builtin"})

        # Filter by requirements
        if filter_unavailable:
            return [
                s
                for s in skills
                if self._check_requirements(self._get_skill_meta(s["name"]))
                and self._has_required_tools(self.get_skill_capabilities(s["name"]), available_tools)
            ]
        return skills

    def load_skill(self, name: str) -> str | None:
        """
        Load a skill by name.

        Args:
            name: Skill name (directory name).

        Returns:
            Skill content or None if not found.
        """
        # Check workspace first
        workspace_skill = self.workspace_skills / name / "SKILL.md"
        if workspace_skill.exists():
            return workspace_skill.read_text(encoding="utf-8")

        # Check built-in
        if self.builtin_skills:
            builtin_skill = self.builtin_skills / name / "SKILL.md"
            if builtin_skill.exists():
                return builtin_skill.read_text(encoding="utf-8")

        return None

    def load_skills_for_context(self, skill_names: list[str]) -> str:
        """
        Load specific skills for inclusion in agent context.

        Args:
            skill_names: List of skill names to load.

        Returns:
            Formatted skills content.
        """
        parts = []
        for name in skill_names:
            content = self.load_skill(name)
            if content:
                content = self._strip_frontmatter(content)
                parts.append(f"### Skill: {name}\n\n{content}")

        return "\n\n---\n\n".join(parts) if parts else ""

    def build_skills_summary(self, available_tools: set[str] | None = None) -> str:
        """
        Build a summary of all skills (name, description, path, availability).

        This is used for progressive loading - the agent can read the full
        skill content using read_file when needed.

        Returns:
            XML-formatted skills summary.
        """
        all_skills = self.list_skills(filter_unavailable=False, available_tools=available_tools)
        if not all_skills:
            return ""

        def escape_xml(s: str) -> str:
            return s.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")

        lines = ["<skills>"]
        for s in all_skills:
            name = escape_xml(s["name"])
            path = s["path"]
            desc = escape_xml(self._get_skill_description(s["name"]))
            skill_meta = self._get_skill_meta(s["name"])
            capabilities = self.get_skill_capabilities(s["name"])
            available = self._check_requirements(skill_meta) and self._has_required_tools(capabilities, available_tools)

            lines.append(f"  <skill available=\"{str(available).lower()}\">")
            lines.append(f"    <name>{name}</name>")
            lines.append(f"    <description>{desc}</description>")
            lines.append(f"    <location>{path}</location>")
            if capabilities.get("triggers"):
                lines.append(
                    f"    <triggers>{escape_xml(', '.join(str(item) for item in capabilities['triggers']))}</triggers>"
                )
            if capabilities.get("output"):
                lines.append(f"    <output>{escape_xml(str(capabilities['output']))}</output>")
            if capabilities.get("risk"):
                lines.append(f"    <risk>{escape_xml(str(capabilities['risk']))}</risk>")
            if capabilities.get("freshness"):
                lines.append(f"    <freshness>{escape_xml(str(capabilities['freshness']))}</freshness>")
            if capabilities.get("tools"):
                lines.append(
                    f"    <tools>{escape_xml(', '.join(str(item) for item in capabilities['tools']))}</tools>"
                )
            if capabilities.get("required_tools"):
                lines.append(
                    f"    <requiredTools>{escape_xml(', '.join(str(item) for item in capabilities['required_tools']))}</requiredTools>"
                )
            if capabilities.get("markets"):
                lines.append(
                    f"    <markets>{escape_xml(', '.join(str(item) for item in capabilities['markets']))}</markets>"
                )
            if capabilities.get("asset_classes"):
                lines.append(
                    f"    <assetClasses>{escape_xml(', '.join(str(item) for item in capabilities['asset_classes']))}</assetClasses>"
                )

            # Show missing requirements for unavailable skills
            if not available:
                missing = self._get_missing_requirements(skill_meta)
                missing_tools = self._get_missing_tools(capabilities, available_tools)
                if missing_tools:
                    missing = ", ".join(filter(None, [missing, missing_tools]))
                if missing:
                    lines.append(f"    <requires>{escape_xml(missing)}</requires>")

            lines.append("  </skill>")
        lines.append("</skills>")

        return "\n".join(lines)

    def _get_missing_requirements(self, skill_meta: dict) -> str:
        """Get a description of missing requirements."""
        missing = []
        requires = skill_meta.get("requires", {})
        for b in requires.get("bins", []):
            if not shutil.which(b):
                missing.append(f"CLI: {b}")
        for env in requires.get("env", []):
            if not os.environ.get(env):
                missing.append(f"ENV: {env}")
        return ", ".join(missing)

    @staticmethod
    def _has_required_tools(capabilities: dict, available_tools: set[str] | None) -> bool:
        """Return True when runtime tool availability satisfies required_tools."""
        if available_tools is None:
            return True
        required = {str(name).strip() for name in capabilities.get("required_tools", []) if str(name).strip()}
        return required.issubset(available_tools)

    @classmethod
    def _get_missing_tools(cls, capabilities: dict, available_tools: set[str] | None) -> str:
        """Describe runtime tool dependencies that are currently missing."""
        if available_tools is None:
            return ""
        required = [str(name).strip() for name in capabilities.get("required_tools", []) if str(name).strip()]
        missing = [name for name in required if name not in available_tools]
        if not missing:
            return ""
        return ", ".join(f"Tool: {name}" for name in missing)

    def _get_skill_description(self, name: str) -> str:
        """Get the description of a skill from its frontmatter."""
        meta = self.get_skill_metadata(name)
        if meta and meta.get("description"):
            return meta["description"]
        return name  # Fallback to skill name

    def _strip_frontmatter(self, content: str) -> str:
        """Remove YAML frontmatter from markdown content."""
        if content.startswith("---"):
            match = re.match(r"^---\n.*?\n---\n", content, re.DOTALL)
            if match:
                return content[match.end():].strip()
        return content

    def _parse_marketbot_metadata(self, raw: str) -> dict:
        """Parse skill metadata JSON from frontmatter (supports marketbot and openclaw keys)."""
        if isinstance(raw, dict):
            return raw.get("marketbot", raw.get("openclaw", raw)) if isinstance(raw, dict) else {}
        try:
            data = json.loads(raw)
            return data.get("marketbot", data.get("openclaw", {})) if isinstance(data, dict) else {}
        except (json.JSONDecodeError, TypeError):
            return {}

    def _check_requirements(self, skill_meta: dict) -> bool:
        """Check if skill requirements are met (bins, env vars)."""
        requires = skill_meta.get("requires", {})
        for b in requires.get("bins", []):
            if not shutil.which(b):
                return False
        for env in requires.get("env", []):
            if not os.environ.get(env):
                return False
        return True

    def _get_skill_meta(self, name: str) -> dict:
        """Get marketbot metadata for a skill (cached in frontmatter)."""
        meta = self.get_skill_metadata(name) or {}
        return self._parse_marketbot_metadata(meta.get("metadata", ""))

    @staticmethod
    def _normalize_metadata_list(value: object) -> list[str]:
        """Normalize metadata into a stable list of strings."""
        if value is None:
            return []
        if isinstance(value, str):
            value = [value]
        if not isinstance(value, list):
            return []
        return [str(item).strip() for item in value if str(item).strip()]

    @classmethod
    def _build_request_profile(cls, text: str, route: dict[str, object] | None = None) -> dict[str, list[str]]:
        """Infer coarse market and asset-class labels for compatibility filtering."""
        route = route or {}
        lowered = text.lower()
        symbols = [str(symbol or "").upper() for symbol in route.get("symbols", []) if str(symbol or "").strip()]
        extracted = re.findall(r"\b(?:[A-Z]{1,5}(?:\.[A-Z]{1,3})?|[A-Z]{2,6}(?:-[A-Z]{2,6})?|(?:SH|SZ)?\d{6}|\d{4,5}\.HK)\b", text)
        for symbol in extracted:
            normalized = str(symbol).upper()
            if normalized not in symbols:
                symbols.append(normalized)
        asset_classes: list[str] = []
        markets: list[str] = []

        def add(bucket: list[str], value: str) -> None:
            if value not in bucket:
                bucket.append(value)

        if route.get("equity"):
            add(asset_classes, "equity")
        if route.get("crypto"):
            add(asset_classes, "crypto")
        if route.get("metals"):
            add(asset_classes, "commodity")
        if route.get("macro"):
            add(asset_classes, "macro")
        if "portfolio" in lowered or "allocation" in lowered or "diversification" in lowered:
            add(asset_classes, "portfolio")
        if "etf" in lowered or any(symbol in {"SPY", "QQQ", "IWM", "GLD", "SLV"} for symbol in symbols):
            add(asset_classes, "etf")

        if "a股" in lowered or "a-share" in lowered or any(re.fullmatch(r"(SH|SZ)?\d{6}", symbol) for symbol in symbols):
            add(markets, "a-share")
        if "港股" in lowered or "hong kong" in lowered or "hong-kong" in lowered or any(
            symbol.endswith(".HK") or (symbol.isdigit() and len(symbol) == 5) for symbol in symbols
        ):
            add(markets, "hong-kong")
        if "美股" in lowered or "us stock" in lowered or "u.s. stock" in lowered:
            add(markets, "us")
        if any(re.fullmatch(r"[A-Z]{1,5}(?:\.[A-Z]{1,3})?", symbol) for symbol in symbols):
            add(markets, "us")
        if route.get("primary") in {"macro", "metals-macro"} or "global" in lowered or "world" in lowered:
            add(markets, "global")
        if len(markets) > 1:
            add(markets, "mixed")

        return {"markets": markets, "asset_classes": asset_classes}

    @staticmethod
    def _matches_profile(capabilities: dict, profile: dict[str, list[str]]) -> bool:
        """Return True when metadata constraints fit the request profile."""
        skill_markets = {item.lower() for item in capabilities.get("markets", [])}
        skill_assets = {item.lower() for item in capabilities.get("asset_classes", [])}
        request_markets = {item.lower() for item in profile.get("markets", [])}
        request_assets = {item.lower() for item in profile.get("asset_classes", [])}

        if skill_markets and request_markets:
            if "global" not in skill_markets and not (skill_markets & request_markets):
                return False
        if skill_assets and request_assets:
            if not (skill_assets & request_assets):
                return False
        return True

    @staticmethod
    def _runtime_supports_request(
        capabilities: dict,
        profile: dict[str, list[str]],
        runtime_profile: dict[str, dict[str, list[str]]] | None,
    ) -> bool:
        """Return True when runtime market/freshness capabilities can satisfy the request."""
        if not runtime_profile:
            return True

        requested_markets = {item.lower() for item in profile.get("markets", [])}
        required_freshness = str(capabilities.get("freshness") or "").strip()
        tool_markets = runtime_profile.get("tool_markets", {})
        tool_freshness = runtime_profile.get("tool_freshness", {})
        relevant_tools = capabilities.get("required_tools") or capabilities.get("tools") or []

        if requested_markets:
            tools_with_market_support = 0
            for tool_name in relevant_tools:
                supported = {item.lower() for item in tool_markets.get(tool_name, [])}
                if not supported:
                    continue
                tools_with_market_support += 1
                if "global" in supported or (supported & requested_markets):
                    continue
                return False
        if required_freshness and relevant_tools:
            if not any(freshness_satisfies(required_freshness, tool_freshness.get(tool_name, [])) for tool_name in relevant_tools):
                return False

        return True

    def get_skill_capabilities(self, name: str) -> dict:
        """Get normalized capability metadata used for routing and reporting."""
        meta = self._get_skill_meta(name)
        return {
            "triggers": self._normalize_metadata_list(meta.get("triggers", [])),
            "output": meta.get("output"),
            "risk": meta.get("risk"),
            "freshness": meta.get("freshness"),
            "tools": self._normalize_metadata_list(meta.get("tools", [])),
            "required_tools": self._normalize_metadata_list(meta.get("required_tools", [])),
            "markets": self._normalize_metadata_list(meta.get("markets", [])),
            "asset_classes": self._normalize_metadata_list(meta.get("asset_classes", [])),
        }

    def match_skills_by_trigger(
        self,
        text: str,
        available_tools: set[str] | None = None,
        runtime_profile: dict[str, dict[str, list[str]]] | None = None,
    ) -> list[str]:
        """Return skills whose trigger metadata matches the given text."""
        return self.match_skills_for_request(text, available_tools=available_tools, runtime_profile=runtime_profile)

    def find_trigger_candidates(self, text: str, available_tools: set[str] | None = None) -> list[str]:
        """Return trigger matches before market/freshness compatibility filtering."""
        lowered = text.lower()
        matched: list[str] = []
        for item in self.list_skills(filter_unavailable=True, available_tools=available_tools):
            capabilities = self.get_skill_capabilities(item["name"])
            triggers = [str(trigger).lower() for trigger in capabilities.get("triggers", [])]
            if any(trigger and trigger in lowered for trigger in triggers):
                matched.append(item["name"])
        return matched

    def match_skills_for_request(
        self,
        text: str,
        route: dict[str, object] | None = None,
        available_tools: set[str] | None = None,
        runtime_profile: dict[str, dict[str, list[str]]] | None = None,
    ) -> list[str]:
        """Return skills whose trigger metadata matches and profile is compatible."""
        lowered = text.lower()
        matched: list[str] = []
        for item in self.list_skills(filter_unavailable=True, available_tools=available_tools):
            capabilities = self.get_skill_capabilities(item["name"])
            triggers = [str(trigger).lower() for trigger in capabilities.get("triggers", [])]
            if not any(trigger and trigger in lowered for trigger in triggers):
                continue
            if not self.is_skill_compatible(
                item["name"],
                text,
                route=route,
                available_tools=available_tools,
                runtime_profile=runtime_profile,
            ):
                continue
            matched.append(item["name"])
        return matched

    def explain_skill_compatibility(
        self,
        name: str,
        text: str,
        route: dict[str, object] | None = None,
        available_tools: set[str] | None = None,
        runtime_profile: dict[str, dict[str, list[str]]] | None = None,
    ) -> dict[str, object]:
        """Return a structured explanation of why a skill is available or blocked."""
        capabilities = self.get_skill_capabilities(name)
        request_profile = self._build_request_profile(text, route=route)
        reasons: list[str] = []

        missing_tools = self._missing_required_tools(capabilities, available_tools)
        if missing_tools:
            reasons.append(f"missing tools: {', '.join(missing_tools)}")

        profile_reason = self._profile_mismatch_reason(capabilities, request_profile)
        if profile_reason:
            reasons.append(profile_reason)

        runtime_reasons = self._runtime_mismatch_reasons(capabilities, request_profile, runtime_profile)
        reasons.extend(runtime_reasons)

        compatible = not reasons
        if compatible:
            reasons.append("requirements satisfied")

        return {
            "name": name,
            "compatible": compatible,
            "reasons": reasons,
            "requestProfile": request_profile,
        }

    def is_skill_compatible(
        self,
        name: str,
        text: str,
        route: dict[str, object] | None = None,
        available_tools: set[str] | None = None,
        runtime_profile: dict[str, dict[str, list[str]]] | None = None,
    ) -> bool:
        """Check whether a skill's metadata fits the request profile."""
        capabilities = self.get_skill_capabilities(name)
        if not self._has_required_tools(capabilities, available_tools):
            return False
        request_profile = self._build_request_profile(text, route=route)
        if not self._runtime_supports_request(capabilities, request_profile, runtime_profile):
            return False
        if not capabilities.get("markets") and not capabilities.get("asset_classes"):
            return True
        return self._matches_profile(capabilities, request_profile)

    @classmethod
    def _missing_required_tools(cls, capabilities: dict, available_tools: set[str] | None) -> list[str]:
        """Return missing runtime tool dependencies."""
        if available_tools is None:
            return []
        required = [str(name).strip() for name in capabilities.get("required_tools", []) if str(name).strip()]
        return [name for name in required if name not in available_tools]

    @staticmethod
    def _profile_mismatch_reason(capabilities: dict, profile: dict[str, list[str]]) -> str | None:
        """Explain a skill metadata mismatch against the request profile."""
        skill_markets = {item.lower() for item in capabilities.get("markets", [])}
        skill_assets = {item.lower() for item in capabilities.get("asset_classes", [])}
        request_markets = {item.lower() for item in profile.get("markets", [])}
        request_assets = {item.lower() for item in profile.get("asset_classes", [])}

        if skill_markets and request_markets and "global" not in skill_markets and not (skill_markets & request_markets):
            return f"metadata markets mismatch: skill={', '.join(sorted(skill_markets))}; request={', '.join(sorted(request_markets))}"
        if skill_assets and request_assets and not (skill_assets & request_assets):
            return f"metadata asset classes mismatch: skill={', '.join(sorted(skill_assets))}; request={', '.join(sorted(request_assets))}"
        return None

    @staticmethod
    def _runtime_mismatch_reasons(
        capabilities: dict,
        profile: dict[str, list[str]],
        runtime_profile: dict[str, dict[str, list[str]]] | None,
    ) -> list[str]:
        """Explain runtime market/freshness mismatches for required tools."""
        if not runtime_profile:
            return []

        reasons: list[str] = []
        requested_markets = {item.lower() for item in profile.get("markets", [])}
        required_freshness = str(capabilities.get("freshness") or "").strip()
        tool_markets = runtime_profile.get("tool_markets", {})
        tool_freshness = runtime_profile.get("tool_freshness", {})
        relevant_tools = capabilities.get("required_tools") or capabilities.get("tools") or []

        for tool_name in relevant_tools:
            supported_markets = {item.lower() for item in tool_markets.get(tool_name, [])}
            if requested_markets and supported_markets and "global" not in supported_markets and not (supported_markets & requested_markets):
                reasons.append(
                    f"runtime market coverage mismatch: {tool_name} supports {', '.join(sorted(supported_markets))}; request={', '.join(sorted(requested_markets))}"
                )

        if required_freshness and relevant_tools:
            freshness_ok = any(freshness_satisfies(required_freshness, tool_freshness.get(tool_name, [])) for tool_name in relevant_tools)
            if not freshness_ok:
                offered = sorted({item for tool_name in relevant_tools for item in tool_freshness.get(tool_name, [])})
                reasons.append(
                    f"runtime freshness mismatch: need {required_freshness}; available={', '.join(offered) if offered else 'unknown'}"
                )

        return reasons

    def get_always_skills(self) -> list[str]:
        """Get skills marked as always=true that meet requirements."""
        result = []
        for s in self.list_skills(filter_unavailable=True):
            meta = self.get_skill_metadata(s["name"]) or {}
            skill_meta = self._parse_marketbot_metadata(meta.get("metadata", ""))
            if skill_meta.get("always") or meta.get("always"):
                result.append(s["name"])
        return result

    def get_skill_metadata(self, name: str) -> dict | None:
        """
        Get metadata from a skill's frontmatter.

        Args:
            name: Skill name.

        Returns:
            Metadata dict or None.
        """
        content = self.load_skill(name)
        if not content:
            return None

        if content.startswith("---"):
            match = re.match(r"^---\n(.*?)\n---", content, re.DOTALL)
            if match:
                return self._parse_frontmatter(match.group(1))

        return None

    @staticmethod
    def _parse_frontmatter(raw: str) -> dict:
        """Parse simple frontmatter with JSON-friendly values."""
        metadata: dict[str, object] = {}
        for line in raw.split("\n"):
            if ":" not in line:
                continue
            key, value = line.split(":", 1)
            key = key.strip()
            text = value.strip()
            if not key:
                continue
            metadata[key] = SkillsLoader._parse_frontmatter_value(text)
        return metadata

    @staticmethod
    def _parse_frontmatter_value(value: str) -> object:
        """Parse scalar or JSON-like frontmatter values."""
        if not value:
            return ""
        if value[0] in "[{":
            try:
                return json.loads(value)
            except json.JSONDecodeError:
                return value

        lowered = value.lower()
        if lowered in {"true", "false"}:
            return lowered == "true"

        if (value.startswith('"') and value.endswith('"')) or (value.startswith("'") and value.endswith("'")):
            return value[1:-1]

        try:
            return int(value)
        except ValueError:
            pass

        try:
            return float(value)
        except ValueError:
            pass

        return value
