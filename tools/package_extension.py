#!/usr/bin/env python3
import argparse, hashlib, io, json, pathlib, sys, zipfile
ROOT=pathlib.Path(__file__).resolve().parents[1]
EXT=ROOT/'extension'
PACKAGE_MANIFEST=ROOT/'release'/'package-manifest.json'
ENTRY_DATE_TIME=(2026,8,8,0,0,0)
ENTRY_MODE=0o100644

# The extension root is the canonical production runtime. Derive the executable closure instead of
# maintaining a second hand-written JS allowlist that can silently omit a newly referenced module.
FILES=['manifest.json', *sorted(p.name for p in EXT.glob('*.js')), 'README.md']

def canonical_text_bytes(path):
    # Git checkout policy may materialize CRLF on Windows and LF on Linux. The
    # release archive owns one physical representation independent of checkout:
    # UTF-8 with LF line endings for every text member.
    text=path.read_bytes().decode('utf-8')
    return text.replace('\r\n','\n').replace('\r','\n').encode('utf-8')

def build_bytes():
    # STORED entries make the complete archive byte-identical across Python/zlib
    # implementations. Compression ratios are not release identity.
    out=io.BytesIO()
    with zipfile.ZipFile(out,'w',zipfile.ZIP_STORED) as z:
        for name in FILES:
            data=canonical_text_bytes(EXT/name)
            info=zipfile.ZipInfo(name,date_time=ENTRY_DATE_TIME)
            # ZipInfo otherwise records the host platform (FAT on Windows,
            # Unix on Linux) in the central directory. Release identity owns
            # that byte too, so always emit the Unix creator used by the
            # canonical 100644 entry-mode contract.
            info.create_system=3
            info.compress_type=zipfile.ZIP_STORED
            info.external_attr=ENTRY_MODE<<16
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
        bad=z.testzip(); infos=z.infolist(); names=[info.filename for info in infos]
    metadata_ok=all(info.compress_type==zipfile.ZIP_STORED and info.date_time==ENTRY_DATE_TIME and info.external_attr==(ENTRY_MODE<<16) for info in infos)
    if bad or names!=FILES or not metadata_ok: raise SystemExit(f'package verification failed: bad={bad} names={names} metadata_ok={metadata_ok}')
    authority=json.loads(PACKAGE_MANIFEST.read_text(encoding='utf-8'))
    expected={
        'schemaVersion':3,
        'version':version,
        'archive':f'AutoAgree-v{version}.zip',
        'compression':'stored',
        'textEncoding':'utf-8',
        'textLineEndings':'lf',
        'entryTimestamp':'2026-08-08T00:00:00Z',
        'entryMode':'100644',
        'entryCreatorSystem':'unix',
        'entries':FILES,
        'sha256':sha,
    }
    if authority != expected:
        raise SystemExit(f'package authority drift: expected={expected} actual={authority}')
    print(f'{out}: sha256={sha}')
    if a.check: out.unlink(missing_ok=True); out.parent.rmdir() if out.parent.exists() and not any(out.parent.iterdir()) else None
if __name__=='__main__': main()
