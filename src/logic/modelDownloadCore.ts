import { FOOD_MODELS, modelKey, modelURL, type FoodModel, type FoodModelId } from './modelCatalog';
export type DownloadState = { phase: 'missing' | 'checking' | 'downloading' | 'verifying' | 'paused' | 'downloaded' | 'error'; progress: number; message?: string };
export type DownloadStates = Record<FoodModelId, DownloadState>;
export type ModelFile = { size: number; modifiedAt?: number };
export interface DownloadIO {
  prepare(): Promise<void>;
  stat(key: string): Promise<ModelFile | undefined>;
  uri(key: string): Promise<string>;
  free(): Promise<number>;
  remove(key: string): Promise<void>;
  move(from: string, to: string): Promise<void>;
  readRecord(key: string): Promise<unknown>;
  writeRecord(key: string, value: unknown): Promise<void>;
  canResume(key: string): Promise<boolean>;
  download(url: string, key: string, progress: (bytes: number) => void): { run(): Promise<number | undefined>; cancel(): Promise<void> };
  hash(key: string, cancelled: () => boolean, progress: (bytes: number) => void): Promise<string>;
}
type Receipt = { version: 1; sha256: string; bytes: number; modifiedAt?: number; revision: string };
type Job = { cancelled: boolean; cancel?: () => Promise<void>; done: Promise<void> };
const blank = (): DownloadState => ({ phase: 'missing', progress: 0 });
const receiptKey = (key: string) => `${key}.verified.json`;

/** Owns transfers independently of any screen. A durable receipt is written only
 * after the pinned bundle's full SHA-256 has passed. Private storage metadata
 * lets subsequent visits avoid rehashing several GB; receipt-less files recover
 * through verification, including a process death between promotion and receipt. */
export class ModelDownloads {
  states: DownloadStates = { e2b: blank(), e4b: blank() };
  private listeners = new Set<() => void>();
  private active?: Job;
  private clearing?: Promise<void>;
  private stopping?: Promise<void>;
  constructor(private io: DownloadIO, private models: FoodModel[] = FOOD_MODELS) {}
  get busy() { return !!this.active || !!this.clearing || !!this.stopping; }
  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; };
  private set(id: FoodModelId, value: DownloadState) { this.states = { ...this.states, [id]: value }; this.emit(); }
  private emit() { for (const fn of this.listeners) fn(); }
  private model(id: FoodModelId) { const m = this.models.find((x) => x.id === id); if (!m) throw new Error('Unknown model'); return m; }
  private run(work: (job: Job) => Promise<void>): Promise<void> {
    if (this.busy) return Promise.resolve();
    const job: Job = { cancelled: false, done: Promise.resolve() };
    this.active = job;
    job.done = Promise.resolve().then(() => work(job)).finally(() => { this.active = undefined; this.emit(); });
    this.emit(); return job.done;
  }
  private async hasReceipt(model: FoodModel, file: ModelFile): Promise<boolean> {
    const value = await this.io.readRecord(receiptKey(modelKey(model)));
    if (!value || typeof value !== 'object') return false;
    const receipt = value as Partial<Receipt>;
    return receipt.version === 1 && receipt.sha256 === model.sha256 && receipt.revision === model.revision
      && receipt.bytes === model.bytes && file.size === model.bytes
      && typeof file.modifiedAt === 'number' && receipt.modifiedAt === file.modifiedAt;
  }
  private async removePart(key: string) {
    await this.io.remove(`${key}.part`);
    await this.io.remove(`${key}.part.resume.json`);
  }
  private async verify(model: FoodModel, source: string, job: Job): Promise<boolean> {
    const key = modelKey(model);
    if (job.cancelled) return false;
    this.set(model.id, { phase: 'verifying', progress: 0 });
    const hash = await this.io.hash(source, () => job.cancelled, (bytes) => {
      if (!job.cancelled) this.set(model.id, { phase: 'verifying', progress: Math.min(1, bytes / model.bytes) });
    });
    if (job.cancelled) return false;
    if (hash !== model.sha256) {
      await this.io.remove(source);
      await this.io.remove(receiptKey(key));
      if (source !== key) await this.io.remove(`${source}.resume.json`);
      throw new Error('File verification failed. Download a fresh copy.');
    }
    // Commit once verified. A late Stop must never erase a valid installed file.
    if (source !== key) { await this.io.remove(key); await this.io.move(source, key); }
    const stat = await this.io.stat(key);
    if (!stat || stat.size !== model.bytes) throw new Error('Could not finish installing this model. Try again.');
    await this.io.writeRecord(receiptKey(key), { version: 1, sha256: hash, bytes: model.bytes, modifiedAt: stat.modifiedAt, revision: model.revision } satisfies Receipt);
    // A stale resume record cannot make a committed installation disappear.
    await this.io.remove(`${key}.part.resume.json`).catch(() => {});
    this.set(model.id, { phase: 'downloaded', progress: 1 });
    return true;
  }
  /** Checks receipts cheaply and recovers a complete download without network use. */
  private async recover(model: FoodModel, job: Job): Promise<boolean> {
    const key = modelKey(model);
    const file = await this.io.stat(key);
    if (job.cancelled) return false;
    if (file?.size === model.bytes) {
      if (await this.hasReceipt(model, file)) {
        if (job.cancelled) return false;
        this.set(model.id, { phase: 'downloaded', progress: 1 }); return true;
      }
      return this.verify(model, key, job);
    }
    const part = await this.io.stat(`${key}.part`);
    if (job.cancelled) return false;
    if (part?.size === model.bytes) return this.verify(model, `${key}.part`, job);
    return false;
  }
  private async stopped(model: FoodModel) {
    // Preserve a committed result even if Stop raced the final atomic writes.
    if (this.states[model.id].phase === 'downloaded') return;
    const part = await this.io.stat(`${modelKey(model)}.part`);
    this.set(model.id, { phase: 'paused', progress: Math.min(1, (part?.size ?? 0) / model.bytes), message: 'Paused. Continue to finish preparing this model.' });
  }
  refresh(): Promise<void> {
    return this.run(async (job) => {
      await this.io.prepare();
      for (const model of this.models) {
        if (job.cancelled) return;
        try {
          if (await this.recover(model, job)) continue;
          if (job.cancelled) { await this.stopped(model); return; }
          const part = await this.io.stat(`${modelKey(model)}.part`);
          if (job.cancelled) return;
          const resumable = part || await this.io.canResume(`${modelKey(model)}.part`);
          if (job.cancelled) return;
          this.set(model.id, resumable ? { phase: 'paused', progress: Math.min(1, (part?.size ?? 0) / model.bytes), message: 'Interrupted download. Continue to finish preparing this model.' } : blank());
        } catch (error) {
          if (job.cancelled) { await this.stopped(model); return; }
          this.set(model.id, { phase: 'error', progress: 0, message: error instanceof Error ? error.message : 'Could not check this model.' });
        }
      }
    });
  }
  start(id: FoodModelId): Promise<void> {
    return this.run(async (job) => {
      const model = this.model(id), key = modelKey(model), part = `${key}.part`;
      try {
        this.set(id, { phase: 'checking', progress: 0 });
        await this.io.prepare();
        if (job.cancelled) return;
        if (await this.recover(model, job)) return;
        if (job.cancelled) return;
        const partialSize = (await this.io.stat(part))?.size ?? 0;
        const resumable = partialSize < model.bytes && await this.io.canResume(part);
        if (!resumable) await this.removePart(key);
        const free = await this.io.free();
        if (job.cancelled) return;
        if (free < model.bytes - (resumable ? partialSize : 0) + 512 * 1024 * 1024) throw new Error('Not enough free storage. Free the remaining download size plus at least 512 MB, then retry.');
        const transfer = this.io.download(modelURL(model), part, (bytes) => {
          if (!job.cancelled) this.set(id, { phase: 'downloading', progress: Math.max(0, Math.min(1, bytes / model.bytes)) });
        });
        job.cancel = () => transfer.cancel();
        this.set(id, { phase: 'downloading', progress: resumable ? partialSize / model.bytes : 0 });
        const status = await transfer.run();
        job.cancel = undefined;
        if (job.cancelled) return;
        if (status !== 200 && status !== 206) throw new Error('Download interrupted. Check your connection and continue.');
        if ((await this.io.stat(part))?.size !== model.bytes) throw new Error('The download is incomplete. Continue to try again.');
        await this.verify(model, part, job);
      } catch (error) {
        if (!job.cancelled) this.set(id, { phase: 'error', progress: this.states[id].progress, message: error instanceof Error ? error.message : 'Could not prepare this model.' });
      } finally {
        if (job.cancelled) await this.stopped(model);
      }
    });
  }
  async getInstalledModel(id: FoodModelId): Promise<string | null> {
    // A photo action never waits behind a multi-GB transfer for another model.
    if (this.busy) return null;
    const model = this.model(id);
    let installed = false;
    await this.run(async (job) => {
      try { await this.io.prepare(); installed = await this.recover(model, job); }
      catch (error) { this.set(id, { phase: 'error', progress: 0, message: error instanceof Error ? error.message : 'Could not check this model.' }); }
      if (!installed && this.states[id].phase === 'downloaded') this.set(id, blank());
    });
    return installed ? this.io.uri(modelKey(model)) : null;
  }
  async cancel() {
    if (this.stopping) return this.stopping;
    const job = this.active;
    if (!job) return;
    job.cancelled = true;
    this.stopping = (async () => {
      if (job.cancel) { try { await job.cancel(); } catch { /* The transfer may already have completed. */ } }
      await job.done;
    })();
    this.emit();
    try { await this.stopping; } finally { this.stopping = undefined; this.emit(); }
  }
  remove(id: FoodModelId): Promise<void> {
    return this.run(async () => {
      const key = modelKey(this.model(id));
      try {
        await this.io.prepare();
        await this.io.remove(receiptKey(key)); await this.io.remove(key); await this.removePart(key); this.set(id, blank());
      } catch { this.set(id, { phase: 'error', progress: 0, message: 'Could not delete the file. Try again.' }); }
    });
  }
  async clear() {
    if (this.clearing) return this.clearing;
    this.clearing = (async () => {
      await this.cancel();
      await this.io.prepare();
      for (const model of this.models) {
        const key = modelKey(model);
        await this.io.remove(receiptKey(key)); await this.io.remove(key); await this.removePart(key); this.set(model.id, blank());
      }
    })();
    this.emit();
    try { await this.clearing; } finally { this.clearing = undefined; this.emit(); }
  }
}
