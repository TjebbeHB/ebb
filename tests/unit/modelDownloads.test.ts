import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ModelDownloads, type DownloadIO, type ModelFile } from '../../src/logic/modelDownloadCore';
import { FOOD_MODELS, modelKey } from '../../src/logic/modelCatalog';
const m = { ...FOOD_MODELS[0]!, bytes: 100 };
const key = modelKey(m), part = `${key}.part`, receipt = `${key}.verified.json`;
function fixture() {
  const files = new Map<string, ModelFile>();
  const records = new Map<string, unknown>();
  let digest = m.sha256, status = 200, bytes = 100, free = 1e10, starts = 0, hashes = 0, mtime = 1;
  let release: (() => void) | undefined;
  const put = (name: string, size: number) => { files.set(name, { size, modifiedAt: mtime++ }); };
  const io: DownloadIO = {
    prepare: async () => {}, stat: async (k) => files.get(k), uri: async (k) => `file:///private/${k}`, free: async () => free,
    remove: async (k) => { files.delete(k); records.delete(k); },
    move: async (a, b) => { files.set(b, files.get(a)!); files.delete(a); },
    readRecord: async (k) => records.get(k), writeRecord: async (k, value) => { records.set(k, value); },
    canResume: async (k) => (files.get(k)?.size ?? 0) > 0,
    hash: async (_k, cancelled) => { hashes++; if (cancelled()) throw Error('Stopped'); return digest; },
    download: (_url, name, progress) => ({
      run: async () => { starts++; await new Promise<void>((r) => { release = r; }); put(name, bytes); progress(bytes); return status; },
      cancel: async () => { release?.(); },
    }),
  };
  return { manager: new ModelDownloads(io, [m]), files, records, io, put, starts: () => starts, hashes: () => hashes,
    release: () => release?.(), setDigest: (s: string) => { digest = s; }, setBytes: (b: number) => { bytes = b; }, setStatus: (s: number) => { status = s; }, setFree: (f: number) => { free = f; } };
}
const tick = () => new Promise<void>((r) => setImmediate(r));
async function finish(f: ReturnType<typeof fixture>) { const job = f.manager.start('e2b'); await tick(); f.release(); await job; }

test('verified installation survives a new manager without hashing or downloading again', async () => {
  const f = fixture(); await finish(f);
  assert.equal(f.manager.states.e2b.phase, 'downloaded');
  assert.equal(f.files.get(key)?.size, 100); assert.equal(f.files.has(part), false); assert.ok(f.records.has(receipt));
  const restarted = new ModelDownloads(f.io, [m]); await restarted.refresh();
  assert.equal(restarted.states.e2b.phase, 'downloaded');
  assert.equal(await restarted.getInstalledModel('e2b'), `file:///private/${key}`);
  assert.equal(f.hashes(), 1); assert.equal(f.starts(), 1);
});
test('short downloads, HTTP failures and corrupt bytes never become available', async () => {
  for (const failure of ['size', 'status', 'hash']) {
    const f = fixture(); if (failure === 'size') f.setBytes(99); if (failure === 'status') { f.setStatus(403); f.setBytes(40); } if (failure === 'hash') f.setDigest('bad');
    await finish(f);
    assert.equal(f.manager.states.e2b.phase, 'error'); assert.equal(f.files.has(key), false); assert.equal(f.records.has(receipt), false);
    if (failure === 'hash') assert.equal(f.files.has(part), false);
  }
});
test('disk check prevents transfer and repeated taps cannot duplicate a download', async () => {
  const f = fixture(); f.setFree(0); await f.manager.start('e2b'); assert.equal(f.starts(), 0);
  f.setFree(1e10); const first = f.manager.start('e2b'); await tick(); await f.manager.start('e2b');
  assert.equal(f.starts(), 1); f.release(); await first; await f.manager.start('e2b'); assert.equal(f.starts(), 1);
});
test('pause waits for writer and retains completed bytes for verification without redownloading', async () => {
  const f = fixture(); const job = f.manager.start('e2b'); await tick(); await f.manager.cancel(); await job;
  assert.equal(f.files.get(part)?.size, 100); assert.equal(f.manager.states.e2b.phase, 'paused'); assert.equal(f.manager.busy, false);
  const restarted = new ModelDownloads(f.io, [m]); await restarted.refresh();
  assert.equal(restarted.states.e2b.phase, 'downloaded'); assert.equal(f.starts(), 1);
});
test('late pause during installation cannot erase the verified model', async () => {
  const f = fixture(); let releaseMove: (() => void) | undefined;
  const originalMove = f.io.move;
  f.io.move = async (from, to) => { await originalMove(from, to); await new Promise<void>((r) => { releaseMove = r; }); };
  const job = f.manager.start('e2b'); await tick(); f.release(); await tick();
  assert.ok(releaseMove); const stopping = f.manager.cancel(); releaseMove!(); await stopping; await job;
  assert.equal(f.manager.states.e2b.phase, 'downloaded'); assert.ok(f.files.has(key)); assert.ok(f.records.has(receipt));
});
test('process failure after promotion recovers without a second network transfer', async () => {
  const f = fixture(); const write = f.io.writeRecord; f.io.writeRecord = async () => { throw Error('Simulated process failure'); };
  await finish(f); assert.equal(f.manager.states.e2b.phase, 'error'); assert.ok(f.files.has(key)); assert.equal(f.records.has(receipt), false);
  f.io.writeRecord = write; const restarted = new ModelDownloads(f.io, [m]); await restarted.refresh();
  assert.equal(restarted.states.e2b.phase, 'downloaded'); assert.equal(f.starts(), 1); assert.equal(f.hashes(), 2);
});
test('legacy final files with no receipt are verified once and recovered', async () => {
  const f = fixture(); f.put(key, m.bytes); await f.manager.refresh(); await f.manager.refresh();
  assert.equal(f.manager.states.e2b.phase, 'downloaded'); assert.equal(f.hashes(), 1); assert.equal(f.starts(), 0);
});
test('a changed file invalidates its receipt and cannot be returned to inference', async () => {
  const f = fixture(); await finish(f); f.put(key, 100); f.setDigest('corrupt');
  assert.equal(await f.manager.getInstalledModel('e2b'), null);
  assert.equal(f.manager.states.e2b.phase, 'error'); assert.equal(f.hashes(), 2); assert.equal(f.records.has(receipt), false);
});
test('a stale installed flag is cleared when the file disappears', async () => {
  const f = fixture(); await finish(f); f.files.delete(key);
  assert.equal(await f.manager.getInstalledModel('e2b'), null); assert.equal(f.manager.states.e2b.phase, 'missing');
});
test('abandoned partial bytes remain available for a resumed transfer', async () => {
  const f = fixture(); f.put(part, 50); await f.manager.refresh();
  assert.equal(f.files.get(part)?.size, 50); assert.equal(f.manager.states.e2b.phase, 'paused');
  f.setStatus(206); await finish(f); assert.equal(f.manager.states.e2b.phase, 'downloaded'); assert.equal(f.starts(), 1);
});
test('a complete abandoned partial is verified and promoted without a download', async () => {
  const f = fixture(); f.put(part, 100); await f.manager.refresh();
  assert.equal(f.manager.states.e2b.phase, 'downloaded'); assert.equal(f.starts(), 0); assert.ok(f.files.has(key));
});
test('unsubscribing a screen leaves its download and installation running', async () => {
  const f = fixture(); let changes = 0; const unsubscribe = f.manager.subscribe(() => { changes++; });
  const job = f.manager.start('e2b'); await tick(); unsubscribe(); const before = changes; f.release(); await job;
  assert.equal(changes, before); assert.equal(f.manager.states.e2b.phase, 'downloaded');
});
test('erase waits for transfer and prevents new transfers until all files and receipts are removed', async () => {
  const f = fixture(); const job = f.manager.start('e2b'); await tick(); const clear = f.manager.clear();
  await f.manager.start('e2b'); await clear; await job;
  assert.equal(f.files.size, 0); assert.equal(f.records.size, 0); assert.equal(f.manager.states.e2b.phase, 'missing'); assert.equal(f.starts(), 1);
});
test('cancelling refresh before lookup finishes does not start hidden verification', async () => {
  const f = fixture(); let release: ((value: ModelFile | undefined) => void) | undefined;
  const stat = f.io.stat; let calls = 0;
  f.io.stat = async (name) => { calls++; if (calls === 1) return new Promise<ModelFile | undefined>((r) => { release = r; }); return stat(name); };
  const refresh = f.manager.refresh(); await tick(); const stopping = f.manager.cancel(); release?.({ size: 100, modifiedAt: 1 }); await stopping; await refresh;
  assert.equal(f.hashes(), 0); assert.equal(f.manager.busy, false);
});
test('requesting a model for inference does not wait behind an unfinished transfer', async () => {
  const f = fixture(); const job = f.manager.start('e2b'); await tick();
  assert.equal(await f.manager.getInstalledModel('e2b'), null); await f.manager.cancel(); await job;
});
test('resume cannot race a pending pause-state write after the transfer ends', async () => {
  const f = fixture(); let finishPause: (() => void) | undefined;
  const download = f.io.download;
  f.io.download = (...args) => {
    const transfer = download(...args);
    return { run: transfer.run, cancel: async () => { await transfer.cancel(); await new Promise<void>((r) => { finishPause = r; }); } };
  };
  const job = f.manager.start('e2b'); await tick(); const stopping = f.manager.cancel(); await tick(); await job;
  assert.equal(f.manager.busy, true); await f.manager.start('e2b'); assert.equal(f.starts(), 1);
  finishPause?.(); await stopping; assert.equal(f.manager.busy, false);
});
test('a malformed or mismatched receipt never skips verification', async () => {
  for (const value of [null, [], { version: 1, bytes: 100, sha256: 'wrong', modifiedAt: 1, revision: m.revision }]) {
    const f = fixture(); f.put(key, 100); f.records.set(receipt, value); await f.manager.refresh();
    assert.equal(f.hashes(), 1); assert.equal(f.manager.states.e2b.phase, 'downloaded');
  }
});
test('deleting a model removes its receipt and partial and next lookup stays missing', async () => {
  const f = fixture(); await finish(f); f.put(part, 20); f.records.set(`${part}.resume.json`, { resumeData: '20' });
  await f.manager.remove('e2b'); assert.equal(f.files.size, 0); assert.equal(f.records.size, 0);
  const restarted = new ModelDownloads(f.io, [m]); assert.equal(await restarted.getInstalledModel('e2b'), null); assert.equal(f.starts(), 1);
});
test('nonessential resume-record cleanup failure cannot hide an installed model', async () => {
  const f = fixture(); const remove = f.io.remove; let committed = false;
  const write = f.io.writeRecord;
  f.io.writeRecord = async (...args) => { await write(...args); committed = true; };
  f.io.remove = async (name) => { if (committed && name === `${part}.resume.json`) throw Error('Cleanup unavailable'); await remove(name); };
  await finish(f); assert.equal(f.manager.states.e2b.phase, 'downloaded');
  assert.equal(await f.manager.getInstalledModel('e2b'), `file:///private/${key}`);
});
