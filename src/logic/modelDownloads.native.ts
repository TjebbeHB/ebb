import * as FS from 'expo-file-system/legacy';
import { AppState, Platform } from 'react-native';
import { requireOptionalNativeModule } from 'expo-modules-core';
import { FOOD_MODELS, modelKey, modelURL, type FoodModelId } from './modelCatalog';
import { ModelDownloads, type DownloadIO } from './modelDownloadCore';

type NativeModelStorage = {
  getModelDirectory(): Promise<string>;
  hashFile(uri: string): Promise<string>;
  cancelHash(): Promise<void>;
  statFile(uri: string): Promise<{ size: number; modifiedAt: number; isDirectory: boolean } | null>;
  moveFile(from: string, to: string): Promise<void>;
  removeFile(uri: string): Promise<void>;
  readTextFile(uri: string): Promise<string | null>;
  writeTextFile(uri: string, text: string): Promise<void>;
  addListener(event: 'onHashProgress', listener: (event: { uri: string; bytes: number }) => void): { remove(): void };
};
const native = requireOptionalNativeModule<NativeModelStorage>('EbbLocalAi');
const storage = () => { if (!native) throw new Error('Update Ebb to use local model storage. The native component is missing in this build.'); return native; };
let root = '';
let transferRoot = '';
const fileURI = (key: string) => (key.endsWith('.part') ? transferRoot : root) + key;
let preparing: Promise<void> | undefined;
const modelForPart = (key: string) => FOOD_MODELS.find((model) => `${modelKey(model)}.part` === key);
const readRecord = async (key: string): Promise<unknown> => {
  const info = await storage().statFile(fileURI(key));
  if (!info || info.isDirectory || info.size > 1024 * 1024) return undefined;
  const text = await storage().readTextFile(fileURI(key));
  try { return text ? JSON.parse(text) : undefined; } catch { return undefined; }
};
const writeRecord = async (key: string, value: unknown) => {
  await storage().writeTextFile(fileURI(key), JSON.stringify(value));
};
async function savedResume(key: string): Promise<string | undefined> {
  const model = modelForPart(key);
  if (!model) return undefined;
  if (Platform.OS === 'android') {
    // Expo's Android resume format is the byte offset. Derive it from the file
    // after the writer has stopped, including after process death or upgrade.
    const file = await storage().statFile(fileURI(key));
    return file && !file.isDirectory && file.size > 0 && file.size < model.bytes ? String(file.size) : undefined;
  }
  const saved = await readRecord(`${key}.resume.json`) as Partial<FS.DownloadPauseState> | undefined;
  return saved?.url === modelURL(model) && saved.fileUri === fileURI(key) && typeof saved.resumeData === 'string' ? saved.resumeData : undefined;
}
const io: DownloadIO = {
  prepare: async () => {
    if (!preparing) preparing = (async () => {
      const path = await storage().getModelDirectory();
      root = path.endsWith('/') ? path : `${path}/`;
      transferRoot = Platform.OS === 'ios' ? `${FS.cacheDirectory}ebb-food-transfers/` : root;
      if (Platform.OS === 'ios') await FS.makeDirectoryAsync(transferRoot, { intermediates: true });
      // Version 1.2 kept verified downloads in evictable cache. Move any surviving
      // full or partial bundle; ModelDownloads verifies it before installation.
      const legacyRoot = `${FS.cacheDirectory}ebb-food-models/`;
      for (const model of FOOD_MODELS) {
        for (const suffix of ['', '.part']) {
          const key = modelKey(model) + suffix;
          if (!(await storage().statFile(fileURI(key))) && await storage().statFile(legacyRoot + key)) {
            await storage().moveFile(legacyRoot + key, fileURI(key));
          }
        }
      }
    })().catch((error) => { preparing = undefined; throw error; });
    await preparing;
  },
  stat: async (key) => { const file = await storage().statFile(fileURI(key)); return file && !file.isDirectory ? file : undefined; },
  uri: async (key) => fileURI(key),
  free: () => FS.getFreeDiskStorageAsync(),
  remove: async (key) => {
    await storage().removeFile(fileURI(key));
    // Delete a legacy duplicate too, so Erase/Delete cannot resurrect it later.
    await storage().removeFile(`${FS.cacheDirectory}ebb-food-models/${key}`);
  },
  move: (from, to) => storage().moveFile(fileURI(from), fileURI(to)),
  readRecord, writeRecord,
  canResume: async (key) => !!(await savedResume(key)),
  download: (url, key, progress) => {
    let task: FS.DownloadResumable | undefined;
    let cancelled = false;
    return {
      run: async () => {
        const resume = await savedResume(key);
        if (cancelled || AppState.currentState === 'background' || AppState.currentState === 'inactive') return undefined;
        task = FS.createDownloadResumable(url, fileURI(key),
          { sessionType: FS.FileSystemSessionType.FOREGROUND }, (event) => progress(event.totalBytesWritten), resume);
        const result = await task.downloadAsync();
        return result?.status;
      },
      cancel: async () => {
        cancelled = true;
        if (!task) return;
        try {
          const saved = await task.pauseAsync();
          if (saved.resumeData) await writeRecord(`${key}.resume.json`, saved);
        } catch {
          // A completed transfer has nothing left to pause. Android can recover
          // any partial from its exact byte count even without a saved record.
          try { await task.cancelAsync(); } catch { /* The writer already ended. */ }
        }
      },
    };
  },
  hash: async (key, cancelled, progress) => {
    if (!native) throw new Error('Native model verification is unavailable. Update Ebb.');
    if (cancelled()) throw new Error('Verification paused.');
    const uri = fileURI(key);
    let cancellation: Promise<void> | undefined;
    const subscription = native.addListener('onHashProgress', (event) => {
      if (event.uri !== uri) return;
      if (cancelled() && !cancellation) cancellation = native.cancelHash().catch(() => {});
      else progress(event.bytes);
    });
    try { return await native.hashFile(uri); } finally { subscription.remove(); await cancellation; }
  },
};
export const modelDownloads = new ModelDownloads(io);
// Navigation never owns a download. Pause only actual transfers when the app is
// backgrounded, preserving resume data and every verified installation.
AppState.addEventListener('change', (state) => {
  if (state !== 'active' && Object.values(modelDownloads.states).some((item) => item.phase === 'downloading')) void modelDownloads.cancel().catch(() => {});
});
export async function getInstalledModel(id: FoodModelId): Promise<string | null> { return modelDownloads.getInstalledModel(id); }
export async function clearModelDownloads() {
  await modelDownloads.clear();
  if (FS.cacheDirectory) await FS.deleteAsync(`${FS.cacheDirectory}ebb-food-runtime/`, { idempotent: true });
}
