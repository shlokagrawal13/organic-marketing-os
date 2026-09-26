#!/usr/bin/env python3
"""Install the checksum-pinned official S3Proxy test server. Java 17+ is required."""
import hashlib
import os
from pathlib import Path
import tempfile
import urllib.request

VERSION = "4.1.1"
SHA256 = "cd2e81919e7e1b8d8a23750c9792bb306a2f841a0222a80919b72e989eedd94b"
URL = f"https://github.com/gaul/s3proxy/releases/download/s3proxy-{VERSION}/s3proxy"
ROOT = Path(__file__).resolve().parent.parent


def main():
    target = ROOT / ".local" / "test-tools" / f"s3proxy-{VERSION}.jar"
    target.parent.mkdir(parents=True, exist_ok=True)
    if target.exists() and hashlib.sha256(target.read_bytes()).hexdigest() == SHA256:
        print(f"Verified existing S3Proxy {VERSION}: {target}")
        return
    with tempfile.TemporaryDirectory(prefix="mos-storage-install-", dir=target.parent) as tmp:
        candidate = Path(tmp) / "s3proxy.jar"
        digest = hashlib.sha256()
        size = 0
        with urllib.request.urlopen(URL, timeout=60) as response, candidate.open("wb") as dest:
            while chunk := response.read(1024 * 1024):
                size += len(chunk)
                if size > 64 * 1024 * 1024:
                    raise RuntimeError("Unexpectedly large release")
                digest.update(chunk)
                dest.write(chunk)
        if digest.hexdigest() != SHA256:
            raise RuntimeError("Release checksum mismatch; existing server was not changed")
        os.replace(candidate, target)
    print(f"Installed checksum-verified S3Proxy {VERSION}: {target}")


if __name__ == "__main__":
    main()
