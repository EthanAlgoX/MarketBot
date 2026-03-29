"""External skill catalog search and installation helpers."""

import re
import shutil
import time
from pathlib import Path

import httpx

_EXTERNAL_CATALOG_CACHE_TTL_S = 60 * 60 * 6
_AWESOME_OPENCLAW_SKILLS_README = "https://raw.githubusercontent.com/VoltAgent/awesome-openclaw-skills/main/README.md"
_OPENCLAW_SKILLS_CONTENTS_API = "https://api.github.com/repos/openclaw/skills/contents"


class ExternalSkillCatalog:
    """Curated external skill catalog lookup and installation support."""

    _catalog_cache: tuple[float, list[dict[str, str]]] | None = None

    @classmethod
    def load_entries(cls) -> list[dict[str, str]]:
        """Load the curated external skill catalog with a short-lived cache."""
        cached = cls._catalog_cache
        now = time.time()
        if cached and (now - cached[0]) < _EXTERNAL_CATALOG_CACHE_TTL_S:
            return [dict(item) for item in cached[1]]

        try:
            with httpx.Client(timeout=5.0, follow_redirects=True) as client:
                response = client.get(_AWESOME_OPENCLAW_SKILLS_README)
                response.raise_for_status()
        except Exception:
            return [dict(item) for item in (cached[1] if cached else [])]

        entries = cls.parse_awesome_openclaw_readme(response.text)
        cls._catalog_cache = (now, entries)
        return [dict(item) for item in entries]

    @classmethod
    def search(cls, text: str, limit: int = 5) -> list[dict[str, str]]:
        """Search curated external skill catalogs when local skills do not fit."""
        return cls.search_entries(cls.load_entries(), text, limit=limit)

    @staticmethod
    def search_entries(entries: list[dict[str, str]], text: str, limit: int = 5) -> list[dict[str, str]]:
        """Search a provided curated skill catalog entry list."""
        if not entries:
            return []

        lowered = text.lower()
        tokens = {token for token in re.findall(r"[a-z0-9\u4e00-\u9fff]+", lowered) if len(token) >= 2}
        ranked: list[tuple[int, dict[str, str]]] = []
        for entry in entries:
            haystack = " ".join(
                [
                    entry.get("name", "").lower(),
                    entry.get("title", "").lower(),
                    entry.get("description", "").lower(),
                    entry.get("category", "").lower(),
                ]
            )
            score = 0
            if entry.get("name", "").replace("-", " ") in lowered:
                score += 8
            for token in tokens:
                if token in haystack:
                    score += 2
            if score <= 0:
                continue
            ranked.append((score, entry))

        ranked.sort(key=lambda item: (-item[0], item[1].get("name", "")))
        results: list[dict[str, str]] = []
        seen: set[str] = set()
        for _, entry in ranked:
            url = entry.get("url", "")
            if not url or url in seen:
                continue
            seen.add(url)
            results.append(dict(entry))
            if len(results) >= limit:
                break
        return results

    @classmethod
    def resolve_slug(cls, identifier: str) -> str | None:
        """Resolve a skill slug from a curated slug or openclaw GitHub URL."""
        return cls.resolve_slug_from_entries(cls.load_entries(), identifier)

    @staticmethod
    def resolve_slug_from_entries(entries: list[dict[str, str]], identifier: str) -> str | None:
        """Resolve a skill slug from a provided catalog entry list or direct URL."""
        raw = str(identifier or "").strip()
        if not raw:
            return None
        url_match = re.match(
            r"^https://github\.com/openclaw/skills/tree/main/skills/([a-z0-9][a-z0-9\-]*)/?$",
            raw,
            re.IGNORECASE,
        )
        if url_match:
            return url_match.group(1).lower()

        slug = raw.strip().lower()
        if re.fullmatch(r"[a-z0-9][a-z0-9\-]*", slug):
            catalog_names = {item.get("name", "").lower() for item in entries}
            if slug in catalog_names:
                return slug
        return None

    @classmethod
    def install(cls, workspace_skills: Path, identifier: str, *, force: bool = False) -> Path:
        """Install a curated external skill into the workspace skills directory."""
        slug = cls.resolve_slug(identifier)
        if not slug:
            raise ValueError(f"Unsupported external skill identifier: {identifier}")

        target_dir = workspace_skills / slug
        if target_dir.exists():
            if not force:
                raise FileExistsError(f"Skill already exists: {target_dir}")
            shutil.rmtree(target_dir)
        target_dir.mkdir(parents=True, exist_ok=True)

        try:
            cls.download_github_skill_tree(f"skills/{slug}", target_dir)
        except Exception:
            if target_dir.exists():
                shutil.rmtree(target_dir, ignore_errors=True)
            raise

        if not (target_dir / "SKILL.md").exists():
            shutil.rmtree(target_dir, ignore_errors=True)
            raise ValueError(f"Installed skill is missing SKILL.md: {slug}")
        return target_dir

    @classmethod
    def download_github_skill_tree(cls, repo_path: str, target_dir: Path) -> None:
        """Download a skill folder recursively from the openclaw/skills repository."""
        headers = {"Accept": "application/vnd.github+json", "User-Agent": "marketbot"}
        with httpx.Client(timeout=10.0, follow_redirects=True, headers=headers) as client:
            cls.download_github_skill_tree_with_client(client, repo_path, target_dir)

    @classmethod
    def download_github_skill_tree_with_client(cls, client: httpx.Client, repo_path: str, target_dir: Path) -> None:
        """Recursive helper used for external skill installation."""
        response = client.get(f"{_OPENCLAW_SKILLS_CONTENTS_API}/{repo_path}")
        response.raise_for_status()
        payload = response.json()
        if not isinstance(payload, list):
            raise ValueError(f"Unexpected GitHub contents payload for {repo_path}")

        for item in payload:
            if not isinstance(item, dict):
                continue
            item_type = str(item.get("type", ""))
            name = str(item.get("name", "")).strip()
            if not name:
                continue
            destination = target_dir / name
            if item_type == "dir":
                destination.mkdir(parents=True, exist_ok=True)
                cls.download_github_skill_tree_with_client(client, str(item.get("path", "")), destination)
                continue
            if item_type != "file":
                continue
            download_url = str(item.get("download_url", "")).strip()
            if not download_url:
                continue
            file_response = client.get(download_url)
            file_response.raise_for_status()
            destination.parent.mkdir(parents=True, exist_ok=True)
            destination.write_bytes(file_response.content)

    @staticmethod
    def parse_awesome_openclaw_readme(content: str) -> list[dict[str, str]]:
        """Parse skill entries from the awesome-openclaw-skills README."""
        if not content.strip():
            return []
        entries: list[dict[str, str]] = []
        category = ""
        pattern = re.compile(
            r"^- \[([^\]]+)\]\((https://github\.com/openclaw/skills/tree/main/skills/[^)]+)\)\s*-\s*(.+)$"
        )
        for raw_line in content.splitlines():
            line = raw_line.strip()
            if not line:
                continue
            heading = re.match(r"^###\s+(.+?)\s*$", line)
            if heading:
                category = heading.group(1).strip()
                continue
            match = pattern.match(line)
            if not match:
                continue
            description = " ".join(match.group(3).split())
            url = match.group(2).strip()
            slug = url.rstrip("/").split("/")[-1]
            entries.append(
                {
                    "name": slug,
                    "title": match.group(1).strip(),
                    "description": description,
                    "category": category,
                    "url": url,
                    "source": "awesome-openclaw-skills",
                    "catalog": "https://github.com/VoltAgent/awesome-openclaw-skills",
                    "repository": "https://github.com/openclaw/skills",
                }
            )
        return entries
