import type { ImportBundle } from './importMerge';

/** Apple Health cycle import is only possible in the installed iOS app. */
export async function healthImportAvailable(): Promise<boolean> {
  return false;
}

export async function importFromAppleHealth(): Promise<ImportBundle> {
  throw new Error('Importing from Apple Health works in the installed iPhone app.');
}
