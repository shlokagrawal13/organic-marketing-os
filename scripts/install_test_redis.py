#!/usr/bin/env python3
"""Build checksum-pinned Redis for disposable tests, without system installation.

Requires a C compiler, make, tar, and Python 3.9+. Official hash:
https://github.com/redis/redis-hashes/blob/master/README
"""
import hashlib
import os
from pathlib import Path
import subprocess
import tarfile
import tempfile
import urllib.request

VERSION = "7.2.11"
SHA256 = "2f9886eca68d30114ad6a01da65631f8007d802fd3e6c9fac711251e6390323d"
ROOT = Path(__file__).resolve().parent.parent


def main():
    tools = ROOT / ".local" / "test-tools"
    tools.mkdir(parents=True, exist_ok=True)
    archive = tools / f"redis-{VERSION}.tar.gz"
    if not archive.exists() or hashlib.sha256(archive.read_bytes()).hexdigest() != SHA256:
        with tempfile.TemporaryDirectory(dir=tools, prefix="redis-download-") as temp:
            candidate = Path(temp) / "redis.tar.gz"
            with urllib.request.urlopen(
                f"https://download.redis.io/releases/redis-{VERSION}.tar.gz", timeout=60
            ) as response, candidate.open("wb") as dest:
                size = 0
                while chunk := response.read(1024 * 1024):
                    size += len(chunk)
                    if size > 16 * 1024 * 1024:
                        raise RuntimeError("Unexpectedly large Redis source archive")
                    dest.write(chunk)
            if hashlib.sha256(candidate.read_bytes()).hexdigest() != SHA256:
                raise RuntimeError("Official Redis checksum mismatch")
            os.replace(candidate, archive)
    source = tools / f"redis-{VERSION}"
    if not source.exists():
        with tarfile.open(archive) as tar:
            for member in tar.getmembers():
                target = (tools / member.name).resolve()
                if not target.is_relative_to(tools.resolve()) or member.issym() or member.islnk():
                    raise RuntimeError("Unsafe Redis archive member")
            tar.extractall(tools)
    subprocess.run(
        ["make", "-C", str(source), "-j2", "MALLOC=libc", "BUILD_TLS=no", "redis-server", "redis-cli"],
        check=True,
    )
    subprocess.run([str(source / "src" / "redis-server"), "--version"], check=True)
    print(f"Test-only Redis ready: {source / 'src' / 'redis-server'}")


if __name__ == "__main__":
    main()
