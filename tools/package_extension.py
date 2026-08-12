#!/usr/bin/env python3
import argparse, hashlib, io, json, pathlib, sys, zipfile
ROOT=pathlib.Path(__file__).resolve().parents[1]
EXT=ROOT/'extension'

# The extension root is the canonical production runtime. Derive the executable closure instead of
# maintaining a second hand-written JS allowlist that can silently omit a newly referenced module.
FILES=['manifest.json', *sorted(p.name for p in EXT.glob('*.js')), 'README.md']

def build_bytes():
    # STORED entries make the complete archive byte-identical across Python/zlib
    # implementations. Compression ratios are not release identity.
    out=io.BytesIO()
    with zipfile.ZipFile(out,'w',zipfile.ZIP_STORED) as z:
        for name in FILES:
            data=(EXT/name).read_bytes()
            info=zipfile.ZipInfo(name,date_time=(2026,8,8,0,0,0))
            info.compress_type=zipfile.ZIP_STORED
            info.external_attr=0o100644<<16
            z.writestr(info,data,compress_type=zipfile.ZIP_STORED)
    return out.getvalue()

def build(out):
    out.parent.mkdir(parents=True,exist_ok=True)
    first=build_bytes(); second=build_bytes()
    if first != second: raise SystemExit('package reproducibility check failed')
    out.write_bytes(first)
    return hashlib.sha256(first).hexdigest()

def main():
    ap=argparse.ArgumentParser(); ap.add_argument('--check',action='store_true'); ap.add_argument('--output')
    a=ap.parse_args()
    manifest=json.loads((EXT/'manifest.json').read_text())
    version=manifest['version']
    out=pathlib.Path(a.output) if a.output else ROOT/'dist'/f'AutoAgree-v{version}.zip'
    sha=build(out)
    with zipfile.ZipFile(out) as z:
        bad=z.testzip(); names=z.namelist()
    if bad or names!=FILES: raise SystemExit(f'package verification failed: bad={bad} names={names}')
    print(f'{out}: sha256={sha}')
    if a.check: out.unlink(missing_ok=True); out.parent.rmdir() if out.parent.exists() and not any(out.parent.iterdir()) else None
if __name__=='__main__': main()
