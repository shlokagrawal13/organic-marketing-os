#!/usr/bin/env python3
"""Offline source checkpoint packaging. No credentials, services or dependencies needed.

Python 3.9+. This carries source and saved project context, not runtime backups.
The secret guard checks known environment values/private-key markers; it is not
a comprehensive secret scanner. Review files before sharing a checkpoint.
"""

import argparse
import hashlib
import json
import os
from pathlib import Path
import re
import sys
import tempfile
from datetime import datetime, timezone
from zipfile import ZIP_DEFLATED, ZipFile

ROOT = Path(__file__).resolve().parents[1]
MANIFEST = "CHECKPOINT_MANIFEST.json"
SKIP_DIRS = {
    "node_modules", ".git", ".local", ".next", "dist", "build", "coverage",
    "test-results", "playwright-report", "__pycache__", ".venv", "venv",
    ".cache", ".pytest_cache",
}
RUNTIME_ROOTS = {"uploads", "backups", "data", "storage", "media_data", ".data"}
PRIVATE_SUFFIXES = {".zip", ".log", ".tsbuildinfo", ".pyc", ".pem", ".key",
                    ".p12", ".pfx", ".sqlite", ".sqlite3", ".db", ".dump", ".bak"}
REQUIRED = {
    "START_HERE.md", "AGENTS.md", "RESUME_PROMPT.txt", "PROJECT_CHECKPOINT.json",
    "PROJECT_STATUS.md", "README.md", "package.json", "package-lock.json",
    ".env.example", "compose.yaml", "Dockerfile", "prisma/schema.prisma",
    "docs/HANDOFF.md", "docs/TASK_BOARD.md", "docs/ACCESS_REQUIREMENTS.md",
    "docs/SESSION_LOG.md", "docs/MASTER_SPEC.md", "docs/REQUIREMENTS_MATRIX.md",
    "docs/VERIFICATION_REPORT.md", "docs/qa/verification-summary.json",
}


def digest(data):
    return hashlib.sha256(data).hexdigest()


def read_json(name):
    return json.loads((ROOT / name).read_text(encoding="utf-8"))


def source_files():
    files = {}
    for directory, dirs, names in os.walk(ROOT, followlinks=False):
        base = Path(directory)
        kept = []
        for name in dirs:
            if name in SKIP_DIRS or (base == ROOT and name in RUNTIME_ROOTS):
                continue
            if (base / name).is_symlink():
                raise ValueError(f"Resolve source symlink before packaging: {(base / name).relative_to(ROOT)}")
            kept.append(name)
        dirs[:] = kept
        for name in names:
            path = base / name
            rel = path.relative_to(ROOT).as_posix()
            if rel == MANIFEST or name == ".DS_Store" or name.startswith(".handoff-manifest-"):
                continue
            if name.startswith(".env") and rel != ".env.example":
                continue
            if name in {".npmrc", ".netrc", ".pypirc", "credentials", "credentials.json"}:
                continue
            if path.suffix.lower() in PRIVATE_SUFFIXES:
                continue
            if path.suffix.lower() == ".sql" and not rel.startswith("prisma/migrations/"):
                continue
            if path.is_symlink():
                raise ValueError(f"Resolve source symlink before packaging: {rel}")
            if path.is_file():
                files[rel] = path
    missing = REQUIRED - files.keys()
    if missing:
        raise ValueError("Required checkpoint files missing: " + ", ".join(sorted(missing)))
    return dict(sorted(files.items()))


def validate_context(files):
    state = read_json("PROJECT_CHECKPOINT.json")
    version = read_json("package.json")["version"]
    lock = read_json("package-lock.json")
    if not (state["applicationVersion"] == lock["version"] == lock["packages"][""]["version"] == version):
        raise ValueError("Checkpoint/package/lockfile versions disagree.")
    if not re.fullmatch(r"[0-9]+\.[0-9]+\.[0-9]+", version):
        raise ValueError("Expected a numeric application release version.")
    if (ROOT / "PROJECT_STATUS.md").read_bytes() != (ROOT / "docs/PROJECT_STATUS.md").read_bytes():
        raise ValueError("Root and docs status copies disagree.")
    board = (ROOT / "docs/TASK_BOARD.md").read_text(encoding="utf-8")
    tasks = state["remainingTasks"]
    ids = {task["id"] for task in tasks}
    if len(ids) != len(tasks) or state["nextTaskId"] not in ids:
        raise ValueError("Task IDs must be unique and include the next task.")
    if state["activeTaskId"] is not None and state["activeTaskId"] not in ids:
        raise ValueError("Active task does not appear in the task board.")
    for task in tasks:
        if f'| {task["id"]} | {task["state"]} |' not in board:
            raise ValueError(f'Task board/state mismatch: {task["id"]}')
    for name in state.get("protectedFiles", {}):
        if name not in files or digest(files[name].read_bytes()) != state["protectedFiles"][name]:
            raise ValueError(f"Protected specification/migration changed: {name}")
    return state


def known_secrets():
    values = set()
    for path in ROOT.glob(".env*"):
        if not path.is_file() or path.name == ".env.example" or path.is_symlink():
            continue
        for line in path.read_text(encoding="utf-8").splitlines():
            match = re.match(r"\s*(?:export\s+)?([A-Z0-9_]+)\s*=\s*(.*)", line)
            if not match:
                continue
            key, value = match.groups()
            value = value.strip().strip("\"'")
            if any(part in key for part in ("PASSWORD", "SECRET", "TOKEN", "_KEY")) and len(value) >= 20:
                if not any(marker in value.upper() for marker in ("GENERATE_WITH_SETUP", "YOUR_KEY", "REPLACE_ME")):
                    values.add(value.encode())
    return values


def inventory(files):
    secrets = known_secrets()
    result = {}
    for name, path in files.items():
        data = path.read_bytes()
        if any(secret in data for secret in secrets):
            raise ValueError(f"Known environment secret found in an included file: {name}")
        if re.search(rb"(?m)^-----BEGIN (?:[A-Z ]+ )?PRIVATE KEY-----\s*$", data):
            raise ValueError(f"Private key found in an included file: {name}")
        result[name] = {"bytes": len(data), "sha256": digest(data)}
    return result


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--check", action="store_true", help="Verify the saved manifest without modifying files.")
    parser.add_argument("--output", type=Path, help="ZIP path outside this project; default is beside the project folder.")
    args = parser.parse_args()
    if args.check and args.output:
        parser.error("--check cannot be combined with --output")
    files = source_files()
    state = validate_context(files)
    current = inventory(files)
    if args.check:
        if not (ROOT / MANIFEST).is_file():
            raise ValueError("No saved manifest. Update the checkpoint and create a package first.")
        saved = read_json(MANIFEST)
        expected = saved["files"]
        differences = sorted(name for name in set(expected) | set(current) if expected.get(name) != current.get(name))
        if differences:
            raise ValueError("Checkpoint differs; preserve/inspect changes and update context before repackaging: " + ", ".join(differences[:15]))
        print(f"Checkpoint verified: {len(current)} source/context/evidence files; no included-file drift.")
        return
    output = (args.output or ROOT.parent / f'organic-marketing-os-v{state["applicationVersion"]}-handoff.zip').resolve()
    if output == ROOT or ROOT in output.parents:
        raise ValueError("Choose a ZIP destination outside the project directory.")
    output.parent.mkdir(parents=True, exist_ok=True)
    manifest = {
        "schemaVersion": 1,
        "applicationVersion": state["applicationVersion"],
        "checkpointRevision": state["checkpointRevision"],
        "createdAtUtc": datetime.now(timezone.utc).isoformat(),
        "scope": "Portable source and saved project context; not runtime/database/media backup.",
        "hashAlgorithm": "sha256",
        "manifestIsSelfExcluded": True,
        "files": current,
    }
    manifest_bytes = (json.dumps(manifest, indent=2, ensure_ascii=False) + "\n").encode()
    prefix = "organic-marketing-os/"
    # Preserve the previous good archive until its replacement has passed checks.
    with tempfile.TemporaryDirectory(prefix="mos-handoff-", dir=output.parent) as directory:
        staged = Path(directory) / "checkpoint.zip"
        with ZipFile(staged, "w", ZIP_DEFLATED, compresslevel=9) as archive:
            for name, path in files.items():
                archive.write(path, prefix + name)
            archive.writestr(prefix + MANIFEST, manifest_bytes)
        with ZipFile(staged) as archive:
            if archive.testzip() is not None:
                raise ValueError("ZIP CRC validation failed.")
            for name, expected in current.items():
                if digest(archive.read(prefix + name)) != expected["sha256"]:
                    raise ValueError(f"Source changed during packaging: {name}; save the checkpoint and retry.")
        descriptor, temp_name = tempfile.mkstemp(prefix=".handoff-manifest-", dir=ROOT)
        try:
            with os.fdopen(descriptor, "wb") as handle:
                handle.write(manifest_bytes)
                handle.flush()
                os.fsync(handle.fileno())
            os.replace(temp_name, ROOT / MANIFEST)
            os.replace(staged, output)
        finally:
            Path(temp_name).unlink(missing_ok=True)
    print(json.dumps({"archive": str(output), "files": len(current) + 1,
                      "bytes": output.stat().st_size,
                      "sha256": digest(output.read_bytes()),
                      "scope": "source checkpoint; runtime data and credentials excluded"}, indent=2))


if __name__ == "__main__":
    try:
        main()
    except (ValueError, OSError, KeyError, json.JSONDecodeError) as error:
        print(f"Checkpoint error: {error}", file=sys.stderr)
        sys.exit(1)
