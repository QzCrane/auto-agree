from pathlib import Path


def replace_once(path: str, old: str, new: str) -> None:
    p = Path(path)
    text = p.read_text(encoding='utf-8')
    count = text.count(old)
    if count != 1:
        raise SystemExit(f'{path}: expected one exact match, found {count}: {old[:120]!r}')
    p.write_text(text.replace(old, new, 1), encoding='utf-8')


replace_once(
    'extension/semantic-core.js',
    "  const SEVERITY = Object.freeze({ ROUTINE: 0, PRIVACY: 1, OPTIONAL: 2, CONSEQUENTIAL: 3, ATTESTATION: 4 });\n\n",
    ""
)

replace_once(
    'tests/static-contract.mjs',
    "const semantic=fs.readFileSync(path.join(root,'semantic-core.js'),'utf8');\nassert.match(semantic,/__AUTO_AGREE_SEMANTIC__\\?\\.version === VERSION/);",
    "const semantic=fs.readFileSync(path.join(root,'semantic-core.js'),'utf8');\nassert.match(semantic,/__AUTO_AGREE_SEMANTIC__\\?\\.version === VERSION/);\nassert.equal(/const\\s+SEVERITY\\s*=\\s*Object\\.freeze/.test(semantic),false,'semantic core must not own a duplicate severity lattice');"
)

replace_once(
    'tests/decision-core.mjs',
    "console.log('decision-core: PASS (7500 shrinkable differential/safety cases)');\n",
    "const severityOwners = fs.readdirSync('extension')\n  .filter(name => name.endsWith('.js'))\n  .filter(name => /const\\s+SEVERITY\\s*=\\s*Object\\.freeze/.test(fs.readFileSync(`extension/${name}`, 'utf8')))\n  .sort();\nassert.deepEqual(severityOwners, ['decision-core.js'], 'DecisionKernel must be the sole production severity-lattice authority');\n\nconsole.log('decision-core: PASS (7500 shrinkable differential/safety cases + sole severity authority)');\n"
)

print('v12-severity-authority-migrate: PASS')
