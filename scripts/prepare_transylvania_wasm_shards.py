#!/usr/bin/env python3
"""Build small, verifiable, independently downloadable Unity WASM shards.

Only creates derived files for the /iceland/ experiment.
Do not modify the original miamiSiteBuild.wasm or /transylvania/ page.
"""
import hashlib
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SOURCE = ROOT / "Build" / "miamiSiteBuild.wasm"
OUTPUT_DIR = ROOT / "Build" / "wasm-shards"
MANIFEST = ROOT / "iceland" / "wasm-chunks.json"
CHUNK_SIZE = 2 * 1024 * 1024
MAGIC = b"\x00asm\x01\x00\x00\x00"


def main():
    if not SOURCE.is_file():
        raise RuntimeError("Original Build/miamiSiteBuild.wasm was not checked out")
    size = SOURCE.stat().st_size
    if size < 1024 * 1024 or size > 512 * 1024 * 1024:
        raise RuntimeError(f"Unexpected WASM file size: {size}")
    with SOURCE.open("rb") as src:
        if src.read(8) != MAGIC:
            raise RuntimeError("Original WASM does not begin with the valid WASM magic/version; do not publish corrupted chunks")
        src.seek(0)
        OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
        whole_hash = hashlib.sha256()
        chunks = []
        index = 0
        while True:
            block = src.read(CHUNK_SIZE)
            if not block:
                break
            filename = f"miamiSiteBuild.wasm.part{index:03d}"
            target = OUTPUT_DIR / filename
            target.write_bytes(block)
            chunks.append({
                "path": f"Build/wasm-shards/{filename}",
                "size": len(block),
                "sha256": hashlib.sha256(block).hexdigest(),
            })
            whole_hash.update(block)
            index += 1
    for stale in OUTPUT_DIR.glob("miamiSiteBuild.wasm.part*"):
        if stale.name not in {Path(x["path"]).name for x in chunks}:
            stale.unlink()
    manifest = {
        "format": "surfvt14-transylvania-wasm-shards-v1",
        "source": "Build/miamiSiteBuild.wasm",
        "totalBytes": size,
        "sha256": whole_hash.hexdigest(),
        "chunkSize": CHUNK_SIZE,
        "parts": chunks,
        "note": "Each shard is a contiguous slice of the exact original Unity WASM; no asset conversion."
    }
    MANIFEST.parent.mkdir(parents=True, exist_ok=True)
    MANIFEST.write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")
    assert sum(p["size"] for p in chunks) == size
    print(f"WASM verified: {size:,} bytes, {len(chunks)} chunks, SHA-256: {whole_hash.hexdigest()}")


if __name__ == "__main__":
    main()
