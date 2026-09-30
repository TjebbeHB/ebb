# Ebb local AI bridge

Android uses the published `com.google.ai.edge.litertlm:litertlm-android:0.16.1` artifact. The later 0.17.0 artifact requires Kotlin 2.4; this app pins Kotlin 2.2.21 to read the 0.16.1 artifact's Kotlin 2.3 metadata. No model weights are bundled in the APK.

The bridge accepts only app-private files. `analyzeMealPhoto(modelUri, imageUri, prompt)` loads the previously verified full multimodal `.litertlm` bundle, uses one image and a fresh conversation, and returns text for the TypeScript meal parser and user confirmation. It has no tools, HTTP client, nutrition calculation, or access to cycle records. The photo should already be re-encoded/resized by the app; the bridge checks a maximum of 2048 px per side and 8 MiB. Only text content is returned; thinking is disabled.

Each analysis runs on a dedicated serial worker, with GPU decoding and GPU vision. If GPU engine initialization fails, it retries CPU decoding with four threads while keeping GPU vision. CPU vision is deliberately not a fallback: it is absent from the official multimodal examples and has reported Gemma crashes. Context is bounded to 4096 tokens and output to 768; audio and speculative decoding are disabled. Engines and conversations close after every request, before its promise resolves. This uses less idle memory at the expense of reloading for the next meal.

Cancellation requests call LiteRT's `cancelProcess` and discard any result. Backgrounding or destroying the module cancels active inference. A four-minute deadline requests cancellation. Native engine initialization does not expose cancellation; if the user cancels during loading, the worker waits for initialization to return, closes the engine, and rejects the result. A second request remains blocked while that cleanup completes. Runtime driver crashes cannot be caught as Java/Kotlin exceptions; actual Galaxy S25 testing remains necessary before claiming device reliability or recognition accuracy.

Both Android and iOS provide private durable storage, atomic receipt writes/moves, and streaming SHA-256 with a 1 MiB read buffer. Android uses `noBackupFilesDir`; iOS uses Application Support with `isExcludedFromBackup`. These are outside disposable caches and OS backups. iOS inference is explicitly unavailable in this version; the Swift module implements storage and hashing only.

Native module name: `EbbLocalAi`. Methods:

- `isInferenceAvailable(): Promise<boolean>` (runtime/ABI present, not an accuracy or memory guarantee).
- `analyzeMealPhoto(modelUri, imageUri, prompt): Promise<string>` (Android).
- `cancelMealAnalysis(): Promise<void>`.
- `getStorageDirectory('models'|'photos')`, `getModelDirectory(): Promise<string>` — directory file URI with trailing slash.
- `hashFile(uri): Promise<string>`, `cancelHash(): Promise<void>`; event `onHashProgress` has `{uri, bytes}`.
- `statFile(uri): Promise<{size, modifiedAt, isDirectory}|null>`; modification time is epoch milliseconds.
- `readTextFile(uri): Promise<string|null>`, `writeTextFile(uri, text): Promise<void>` — receipts limited to 1 MiB.
- `moveFile`, `copyFile`, `removeFile`, `listDirectory` — app-private local paths only.
- Event `onAnalysisProgress` has `stage: 'loading'|'loading_cpu'|'recognizing'`.

Native validation: `cd android && ./gradlew :ebb-local-ai:testDebugUnitTest`. Hash tests check chunk boundaries and that cancellation preserves the source file. A physical-device acceptance test must download/recover a model, restart the app, recognize several varied meals, confirm/edit records, cancel while loading/generating, background the app, delete retained photos/models, and test low-memory behavior. These tests require real model files and suitable phone hardware.

Primary references, checked 2026-09-12:

- [Official Kotlin API and multimodal configuration](https://github.com/google-ai-edge/LiteRT-LM/blob/main/docs/api/kotlin/getting_started.md)
- [Published Android artifact metadata](https://dl.google.com/dl/android/maven2/com/google/ai/edge/litertlm/litertlm-android/maven-metadata.xml)
- [Official runtime source](https://github.com/google-ai-edge/LiteRT-LM)
