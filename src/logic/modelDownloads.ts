import type { ModelDownloads } from './modelDownloadCore';
import type { FoodModelId } from './modelCatalog';
// Web previews cannot download native LiteRT bundles.
export const modelDownloads: ModelDownloads | null = null;
export async function getInstalledModel(_id: FoodModelId): Promise<string | null> { return null; }
export async function clearModelDownloads() {}
