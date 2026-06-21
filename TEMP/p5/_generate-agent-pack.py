#!/usr/bin/env python3
from pathlib import Path

P5 = Path("/home/hamed/Music/docs/TEMP/p5")
REPO = Path("/home/hamed/Music/docs")

def write(rel, content):
    p = P5 / rel if not rel.startswith("..") else REPO / rel.replace("../", "")
    if rel.startswith("../"):
        p = REPO / rel[3:]
    else:
        p = P5 / rel
    p.parent.mkdir(parents=True, exist_ok=True)
    p.write_text(content.rstrip() + "\n", encoding="utf-8")

print("generator ready")
