export type FoodModelId = 'e2b' | 'e4b';
export interface FoodModel {
  id: FoodModelId; name: string; bytes: number; sha256: string; revision: string; file: string; repo: string;
}
// Full mobile multimodal bundles; the smaller web/GPU bundles are text-only.
// Revision, length and SHA-256 from the publisher's file API, 2026-09-12.
export const FOOD_MODELS: FoodModel[] = [
  { id: 'e2b', name: 'Gemma 4 E2B', bytes: 2588147712,
    sha256: '181938105e0eefd105961417e8da75903eacda102c4fce9ce90f50b97139a63c',
    revision: 'b3ca0d2f076785a8f4b2219ddbd2bdb99954eae1',
    repo: 'litert-community/gemma-4-E2B-it-litert-lm', file: 'gemma-4-E2B-it.litertlm' },
  { id: 'e4b', name: 'Gemma 4 E4B', bytes: 3659530240,
    sha256: '0b2a8980ce155fd97673d8e820b4d29d9c7d99b8fa6806f425d969b145bd52e0',
    revision: '2eee7ac325f20eb8c9ac1d0e972f7c84663062da',
    repo: 'litert-community/gemma-4-E4B-it-litert-lm', file: 'gemma-4-E4B-it.litertlm' },
];
export const modelURL = (m: FoodModel) => `https://huggingface.co/${m.repo}/resolve/${m.revision}/${m.file}`;
export const modelKey = (m: FoodModel) => `${m.id}-${m.sha256.slice(0, 12)}.litertlm`;
export const modelGB = (bytes: number) => `${(bytes / 1e9).toFixed(2)} GB`;
