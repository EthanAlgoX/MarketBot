#!/usr/bin/env python3
"""Export or replay the pinned AIStock source overlay, without local data/secrets."""

from __future__ import annotations

import argparse
import hashlib
import json
import os
from pathlib import Path
import re
import shutil
import stat
import subprocess
import tempfile
import zipfile

ROOT = Path(__file__).resolve().parents[1]
ENGINE = ROOT / "services/financial-engine"
ARTIFACT = ROOT / "integrations/financial-engine"
BASELINE = "cec0078ca75aeb76ced28ae8bb0f1e22481d22d1"
REMOTE = "https://github.com/EthanAlgoX/AIStock.git"
DIRECTORIES = {"api", "src", "data_provider", "scripts", "tests", "docs"}
SUFFIXES = {".py", ".md", ".txt", ".json", ".yaml", ".yml"}


def git(args, cwd, *, allowed=(0,)):
    result = subprocess.run(["git", *args], cwd=cwd, capture_output=True)
    if result.returncode not in allowed:
        raise RuntimeError("Source Git operation failed; no target contents were replaced.")
    return result.stdout


def digest(value):
    return hashlib.sha256(value).hexdigest()


def permitted(name):
    path = Path(name)
    if path.is_absolute() or ".." in path.parts or not path.parts:
        return False
    if any(part.startswith(".") or part == "__pycache__" for part in path.parts):
        return name == ".env.example"
    return path.parts[0] in DIRECTORIES and path.suffix in SUFFIXES


def file_entry(folder, name):
    if not permitted(name):
        raise RuntimeError("Overlay contains an unexpected source path.")
    path = folder / name
    if path.is_symlink():
        raise RuntimeError("Source overlays do not accept symlinks.")
    if not path.exists():
        return {"path": name, "deleted": True}
    return {"path": name, "sha256": digest(path.read_bytes()),
            "mode": "100755" if path.stat().st_mode & stat.S_IXUSR else "100644"}


def export():
    if git(["rev-parse", "HEAD"], ENGINE).decode().strip() != BASELINE:
        raise RuntimeError("Financial engine HEAD differs from the reviewed pinned baseline.")
    tracked = git(["diff", "--name-only", "--no-renames", BASELINE], ENGINE).decode().splitlines()
    untracked = git(["ls-files", "--others", "--exclude-standard"], ENGINE).decode().splitlines()
    names = sorted(set(tracked + untracked))
    if not names or any(not permitted(name) for name in names):
        raise RuntimeError("Export accepts only reviewed source/documentation paths, excluding runtime files.")
    entries = [file_entry(ENGINE, name) for name in names]
    patch = git(["diff", "--binary", "--no-renames", BASELINE, "--", *tracked], ENGINE) if tracked else b""
    for name in sorted(untracked):
        path = ENGINE / name
        mode = "100755" if path.stat().st_mode & stat.S_IXUSR else "100644"
        if path.stat().st_size == 0:
            patch += (f"diff --git a/{name} b/{name}\nnew file mode {mode}\n"
                      "index 0000000..e69de29\n").encode()
        else:
            patch += git(["diff", "--no-index", "--binary", "--", "/dev/null", name], ENGINE,
                         allowed=(0, 1))
    ARTIFACT.mkdir(parents=True, exist_ok=True)
    (ARTIFACT / "overlay.patch").write_bytes(patch)
    manifest = {"formatVersion": 1, "repository": REMOTE, "baseline": BASELINE,
                "patchSha256": digest(patch), "files": entries,
                "excluded": ["local environments", "credentials", "databases", "logs", "venvs", "node_modules"]}
    (ARTIFACT / "manifest.json").write_text(json.dumps(manifest, indent=2) + "\n")
    print(json.dumps({"exportedSourceFiles": len(entries), "baseline": BASELINE}))


def read_overlay():
    manifest = json.loads((ARTIFACT / "manifest.json").read_text())
    patch = (ARTIFACT / "overlay.patch").read_bytes()
    if (manifest.get("formatVersion") != 1 or manifest.get("baseline") != BASELINE
            or manifest.get("repository") != REMOTE or digest(patch) != manifest.get("patchSha256")):
        raise RuntimeError("Source overlay manifest/checksum is invalid.")
    names = [entry["path"] for entry in manifest["files"]]
    if len(names) != len(set(names)) or any(not permitted(name) for name in names):
        raise RuntimeError("Source overlay path manifest is invalid.")
    return manifest


def check_files(folder, manifest):
    for entry in manifest["files"]:
        if file_entry(folder, entry["path"]) != entry:
            raise RuntimeError("Source overlay differs from the packaged manifest.")
        path = folder / entry["path"]
        if path.suffix == ".py" and path.exists():
            compile(path.read_bytes(), str(path), "exec")


def apply(folder, manifest):
    patch = str((ARTIFACT / "overlay.patch").resolve())
    git(["apply", "--check", "--whitespace=nowarn", patch], folder)
    git(["apply", "--whitespace=nowarn", patch], folder)
    check_files(folder, manifest)


def bootstrap(target):
    manifest = read_overlay()
    target = target.resolve()
    if target.exists():
        if target.is_symlink() or git(["rev-parse", "HEAD"], target).decode().strip() != BASELINE:
            raise RuntimeError("Existing target is not the pinned engine; refusing to replace it.")
        check_files(target, manifest)
        changed = set(git(["diff", "--name-only", "--no-renames", BASELINE], target).decode().splitlines())
        if changed - {entry["path"] for entry in manifest["files"]}:
            raise RuntimeError("Existing target has additional edits; refusing to replace them.")
        print("Pinned financial engine and source overlay are already present.")
        return
    target.parent.mkdir(parents=True, exist_ok=True)
    staging = Path(tempfile.mkdtemp(prefix=".financial-engine-", dir=target.parent))
    try:
        git(["init", "--quiet"], staging)
        git(["remote", "add", "origin", REMOTE], staging)
        git(["fetch", "--depth=1", "origin", BASELINE], staging)
        git(["checkout", "--detach", "--quiet", "FETCH_HEAD"], staging)
        apply(staging, manifest)
        if target.exists():
            raise RuntimeError("Target appeared during bootstrap; refusing to replace it.")
        os.rename(staging, target)
    finally:
        if staging.exists():
            shutil.rmtree(staging)
    print(json.dumps({"bootstrapped": str(target), "baseline": BASELINE,
                      "sourceFilesVerified": len(manifest["files"])}))


def verify():
    """Offline replay from the actual pinned Git objects; no copied runtime state."""
    manifest = read_overlay()
    local = ROOT / ".local/source-replay"
    local.mkdir(parents=True, mode=0o700, exist_ok=True)
    with tempfile.TemporaryDirectory(prefix="verify-", dir=local) as temporary:
        folder = Path(temporary)
        archive = folder / "baseline.zip"
        archive.write_bytes(git(["archive", "--format=zip", BASELINE], ENGINE))
        with zipfile.ZipFile(archive) as source:
            for info in source.infolist():
                path = Path(info.filename)
                if path.is_absolute() or ".." in path.parts:
                    raise RuntimeError("Pinned archive contains an unsafe path.")
            source.extractall(folder)
        archive.unlink()
        git(["init", "--quiet"], folder)
        apply(folder, manifest)
    print(json.dumps({"sourceReplayVerified": True, "baseline": BASELINE,
                      "overlayFiles": len(manifest["files"]), "runtimeStateCopied": False}))


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("action", choices=("export", "bootstrap", "verify"))
    parser.add_argument("--target", type=Path, default=ENGINE)
    args = parser.parse_args()
    if args.action == "export":
        export()
    elif args.action == "verify":
        verify()
    else:
        bootstrap(args.target)


if __name__ == "__main__":
    try:
        main()
    except (RuntimeError, OSError, ValueError) as error:
        raise SystemExit(str(error)) from None
