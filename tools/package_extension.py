#!/usr/bin/env python3
import argparse, hashlib, json, pathlib, sys, zipfile
ROOT=pathlib.Path(__file__).resolve().parents[1]
EXT=ROOT/'extension'
FILES=['manifest.json','bootstrap.js','semantic-core.js','gate.js','risk-core.js','engine.js','worker.js','README.md']

def build(out):
    out.parent.mkdir(parents=True,exist_ok=True)
    with zipfile.ZipFile(out,'w',zipfile.ZIP_DEFLATED,compresslevel=9) as z:
        for name in FILES:
            data=(EXT/name).read_bytes()
            info=zipfile.ZipInfo(name,date_time=(2026,8,8,0,0,0))
            info.compress_type=zipfile.ZIP_DEFLATED
            info.external_attr=0o100644<<16
            z.writestr(info,data,compress_type=zipfile.ZIP_DEFLATED,compresslevel=9)
    return hashlib.sha256(out.read_bytes()).hexdigest()

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
