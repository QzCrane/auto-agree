from pathlib import Path

for path, risk in [
    ('tests/property-consent-model.mjs', True),
    ('tests/property-consent-fast-check.mjs', True),
    ('tests/property-semantic-fragmentation.mjs', False),
]:
    p = Path(path)
    text = p.read_text()
    old = "const context = vm.createContext({ console });\nvm.runInContext(fs.readFileSync('extension/semantic-core.js', 'utf8'), context);"
    new = "const context = vm.createContext({ console, WeakRef, performance });\nvm.runInContext(fs.readFileSync('extension/runtime-kernel.js', 'utf8'), context);\nvm.runInContext(fs.readFileSync('extension/semantic-core.js', 'utf8'), context);"
    if text.count(old) != 1:
        raise SystemExit(f'{path}: semantic VM bootstrap anchor changed')
    p.write_text(text.replace(old, new))

print('runtime-kernel semantic VM harness migration prepared successfully')
