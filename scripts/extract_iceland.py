#!/usr/bin/env python3
"""Extract inspectable Iceland Unity WebGL Mesh/Texture/Sprite assets.

The output is a technical extract for the /iceland/ prototype's asset viewer,
NOT a replacement scene in the compiled Unity 2022 Transylvania runtime.
"""
from __future__ import annotations
import argparse
import gzip
import json
import os
import re
import struct
import sys
import tempfile
from collections import Counter
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

MAGIC = b"UnityWebData1.0\x00"
MAX_FILES = 10000
RELEVANT = (
    "iceland", "snow", "ice", "winter", "track", "train", "rail", "tunnel",
    "ground", "building", "building", "house", "wall", "roof", "city", "scen",
    "environment", "terrain", "road", "bridge", "sky", "mountain", "tree",
    "floor", "atlas", "light", "fence", "platform", "station", "surface",
    "obstacle", "barrier", "building", "lamp", "grass", "stone", "texture",
)
ALLOWED = {"Texture2D", "Sprite", "Mesh", "Material", "Texture2DArray"}

def safe_name(name: str) -> str:
    return (re.sub(r"[^A-Za-z0-9_.-]+", "_", name or "unnamed").strip("._") or "asset")[:110]

def decode_archive(src: Path) -> tuple[bytes, str]:
    raw = src.read_bytes()
    if raw.startswith(b"version https://git-lfs.github.com/spec"):
        raise RuntimeError("Git LFS pointer found instead of Iceland data; checkout needs lfs: true")
    if raw.startswith(MAGIC):
        return raw, "plain UnityWebData1.0"
    if raw[:2] == b"\x1f\x8b":
        data = gzip.decompress(raw)
        if data.startswith(MAGIC):
            return data, "gzip UnityWebData1.0"
    try:
        import brotli
        data = brotli.decompress(raw)
        if data.startswith(MAGIC):
            return data, "brotli UnityWebData1.0"
    except (brotli.error, MemoryError):
        pass
    if raw.startswith((b"UnityFS", b"UnityRaw", b"UnityWeb")):
        return raw, "Unity bundle"
    raise RuntimeError("Unrecognized Iceland WebGL archive header: " + raw[:24].hex())

def unpack_webdata(raw: bytes, dest: Path) -> list[dict]:
    if not raw.startswith(MAGIC):
        (dest / "source.bundle").write_bytes(raw)
        return [{"path": "source.bundle", "bytes": len(raw)}]
    hlen = struct.unpack_from("<I", raw, 16)[0]
    if not 20 <= hlen <= min(len(raw), 20 * 1024 * 1024):
        raise RuntimeError("Invalid UnityWebData header length " + str(hlen))
    entries = []
    pos = 20
    while pos < hlen:
        if pos + 12 > hlen:
            raise RuntimeError("Truncated UnityWebData file index")
        offset, size, namelen = struct.unpack_from("<III", raw, pos)
        pos += 12
        if namelen < 1 or namelen > 8192 or pos + namelen > hlen:
            raise RuntimeError("Invalid name length in UnityWebData")
        name = raw[pos:pos + namelen].decode("utf-8", errors="replace")
        pos += namelen
        if offset < hlen or offset + size > len(raw):
            raise RuntimeError("Invalid entry offset/size: " + name)
        name = "/".join(safe_name(x) for x in name.replace("\\", "/").split("/") if x not in ("", ".", ".."))
        if not name:
            continue
        file_path = dest / name
        file_path.parent.mkdir(parents=True, exist_ok=True)
        file_path.write_bytes(raw[offset: offset + size])
        entries.append({"path": name, "bytes": size})
        if len(entries) > MAX_FILES:
            raise RuntimeError("Too many files inside Iceland WebGL package")
    return entries

def inspect_and_export(src: Path, dest: Path, limit_mb: int):
    dest.mkdir(parents=True, exist_ok=True)
    for category in ("textures", "meshes", "sprites", "materials"):
        (dest / category).mkdir(exist_ok=True)

    report: dict[str, Any] = {
        "map": "Iceland",
        "origin": "vtcaua2014-dev/surfvt/public/maps/iceland/build/iceland/iceland.alt.data.unityweb",
        "unityVersion": "2019.2.0f1",
        "generatedAt": datetime.now(timezone.utc).isoformat(),
        "status": "not-extracted",
        "rawFiles": [],
        "objectsByType": {},
        "assets": [],
        "errors": [],
        "note": "Export for inspection and independent viewing; not inserted into the compiled Transylvania Unity scene.",
    }
    max_bytes = max(1, limit_mb) * 1024 * 1024
    used = 0
    try:
        import UnityPy
        UnityPy.config.FALLBACK_UNITY_VERSION = "2019.2.0f1"
        raw, packing = decode_archive(src)
        report["compression"] = packing
        report["inputBytes"] = src.stat().st_size
        report["uncompressedBytes"] = len(raw)
        with tempfile.TemporaryDirectory(prefix="iceland_webgl_") as temp:
            unpack_dir = Path(temp)
            report["rawFiles"] = unpack_webdata(raw, unpack_dir)
            # Resource files and serialized scenes must share a filesystem.
            try:
                env = UnityPy.load(str(unpack_dir))
            except Exception as exc:
                report["errors"].append("Folder load: " + str(exc)[:450])
                env = None

            candidates = []
            if env:
                for obj in env.objects:
                    try:
                        typename = obj.type.name
                        if typename in ALLOWED:
                            name = obj.peek_name() or "unnamed"
                            score = sum(10 for keyword in RELEVANT if keyword in name.lower())
                            candidates.append((score, typename, name, obj))
                    except Exception as exc:
                        report["errors"].append("Index asset: " + str(exc)[:180])

            if not candidates:
                report["errors"].append("No Mesh/Texture2D/Sprite assets readable by UnityPy.")
            candidates.sort(key=lambda x: (-x[0], x[1], x[2]))
            report["objectsByType"] = dict(Counter(t for _,t,_,_ in candidates))
            seen = set()
            for score, typename, name, reader in candidates:
                if used >= max_bytes:
                    break
                key = (typename, name)
                # Different Unity objects sometimes have identical names; keep distinct ids.
                try:
                    parsed = reader.parse_as_object()
                    ident = str(getattr(reader, "path_id", getattr(reader, "path_id", len(seen))))
                    name = safe_name(str(getattr(parsed, "m_Name", name) or name))
                    target_name = safe_name(name + "_" + ident)
                    if (typename, ident) in seen:
                        continue
                    seen.add((typename, ident))
                    if typename in ("Texture2D", "Texture2DArray", "Sprite"):
                        folder = "sprites" if typename == "Sprite" else "textures"
                        image = getattr(parsed, "image", None)
                        if image is None:
                            continue
                        if typename == "Texture2DArray":
                            # Export initial slice only; other slices remain inventoried.
                            images = getattr(parsed, "images", [])
                            image = images[0] if images else None
                            if image is None:
                                continue
                        if image.width > 8192 or image.height > 8192:
                            continue
                        image.thumbnail((2048, 2048))
                        rel = folder + "/" + target_name + ".png"
                        file_path = dest / rel
                        image.save(file_path, optimize=True)
                        width, height = image.size
                        rec = {"type":typename,"name":name,"file":rel,"bytes":file_path.stat().st_size,
                            "width":width,"height":height,"priority":score}
                    elif typename == "Mesh":
                        rel = "meshes/" + target_name + ".obj"
                        data = parsed.export()
                        if not data:
                            continue
                        if len(data) > 6 * 1024 * 1024:
                            continue
                        file_path = dest / rel
                        file_path.write_text(data, encoding="utf-8")
                        rec = {"type":typename,"name":name,"file":rel,"bytes":file_path.stat().st_size,
                            "priority":score}
                    elif typename == "Material":
                        # Material mappings need Unity object references to rebuild.
                        rec = {"type":typename,"name":name,"file":None,"priority":score,
                            "note":"Material identified; shader and texture links require scene reconstruction."}
                        report["assets"].append(rec)
                        continue
                    else:
                        continue
                    if rec["bytes"] > 8 * 1024 * 1024 or used + rec["bytes"] > max_bytes:
                        file_path.unlink(missing_ok=True)
                        continue
                    used += rec["bytes"]
                    report["assets"].append(rec)
                except Exception as exc:
                    if len(report["errors"]) < 160:
                        report["errors"].append(typename+" "+name+": "+str(exc)[:250])
    except Exception as exc:
        report["errors"].append(type(exc).__name__+": "+str(exc)[:500])
    report["publishedBytes"] = used
    report["exportedFiles"] = sum(bool(a.get("file")) for a in report["assets"])
    report["status"] = "extracted" if report["exportedFiles"] > 0 else "not-extracted"
    (dest / "manifest.json").write_text(json.dumps(report, indent=2, ensure_ascii=False), encoding="utf-8")
    print(json.dumps({
        "status":report["status"],"packedFiles":len(report["rawFiles"]),
        "objects":report["objectsByType"],"exportedFiles":report["exportedFiles"],
        "publishedBytes":used,"errors":report["errors"][:8],
    }, indent=2, ensure_ascii=False))
    return report

if __name__ == "__main__":
    parser=argparse.ArgumentParser()
    parser.add_argument("--source",required=True)
    parser.add_argument("--output",required=True)
    parser.add_argument("--max-mb",type=int,default=55)
    args=parser.parse_args()
    report=inspect_and_export(Path(args.source),Path(args.output),args.max_mb)
    # Failure leaves an honest manifest rather than claiming assets exist.
    sys.exit(0 if report["status"]=="extracted" else 2)
