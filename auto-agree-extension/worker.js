'use strict';

const inflight = new Map();

function targetFor(sender) {
  const tabId = sender.tab?.id;
  if (!Number.isInteger(tabId)) return null;
  if (sender.documentId) return { tabId, documentIds: [sender.documentId] };
  if (Number.isInteger(sender.frameId)) return { tabId, frameIds: [sender.frameId] };
  return { tabId };
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (!message || message.type !== 'AUTO_AGREE_ACTIVATE') return false;

  const target = targetFor(sender);
  if (!target) {
    sendResponse({ ok: false, error: 'missing-target' });
    return false;
  }

  const key = sender.documentId || `${target.tabId}:${sender.frameId ?? 0}`;
  let promise = inflight.get(key);
  if (!promise) {
    promise = chrome.scripting.executeScript({
      target,
      files: ['engine.js'],
      world: 'ISOLATED',
      injectImmediately: true
    }).finally(() => inflight.delete(key));
    inflight.set(key, promise);
  }

  promise.then(
    () => sendResponse({ ok: true }),
    error => sendResponse({ ok: false, error: String(error?.message || error) })
  );
  return true;
});
