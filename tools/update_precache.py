#!/usr/bin/env python3
"""Regenerates the PRECACHE list in frontend/sw.js from the files on disk and bumps nothing else.
Run before every frontend deploy:  python tools/update_precache.py  (then bump VERSION in sw.js if files changed)."""
import re
from pathlib import Path

root = Path(__file__).resolve().parent.parent / "frontend"
exts = {".html", ".css", ".js", ".png", ".woff2", ".webmanifest"}
skip = {"sw.js"}
files = sorted("/" + p.relative_to(root).as_posix() for p in root.rglob("*") if p.suffix in exts and p.name not in skip and "tools" not in p.parts)
block = "// <precache>\nconst PRECACHE = [\n" + "".join(f'  "{f}",\n' for f in files) + "];\n// </precache>"
sw = root / "sw.js"
text = sw.read_text()
new = re.sub(r"// <precache>.*?// </precache>", lambda _: block, text, flags=re.S)
sw.write_text(new)
print(f"Precached {len(files)} files")
