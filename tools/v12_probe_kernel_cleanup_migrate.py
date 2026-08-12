from pathlib import Path

p = Path('extension/bootstrap.js')
text = p.read_text()
old = """    for (const job of deep) releaseDeep(job);
    deep.length = 0;
    deepRecoveryRef = null;
    chrome.runtime.sendMessage({ type: 'AUTO_AGREE_GATE', reason }, response => {
"""
new = """    for (const job of deep) releaseDeep(job);
    deepWork.clear();
    chrome.runtime.sendMessage({ type: 'AUTO_AGREE_GATE', reason }, response => {
"""
if text.count(old) != 1:
    raise SystemExit(f'Probe requestGate cleanup anchor changed: {text.count(old)}')
p.write_text(text.replace(old, new))
print('Probe handoff cleanup migrated to shared kernel')
