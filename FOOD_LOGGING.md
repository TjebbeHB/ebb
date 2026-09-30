# Meal logging in Ebb 1.3.0

## Android test flow

Install the 1.3.0 APK **over the existing app**, without uninstalling. Open Settings → Food AI. Surviving E2B/E4B files from 1.2 are recovered from cache, verified once and moved into persistent private storage. A completed partial download can also recover without transferring it again. Files already erased by 1.2 or reclaimed by the OS cannot be recovered. Installed models retain verification receipts and remain selectable after restart. Android partial downloads resume by offset; going to the background pauses a transfer, while navigating inside Ebb does not.

Open Food → Take a photo or Choose a photo. Ebb re-encodes a bounded JPEG copy, without gallery metadata, for local recognition. The selected Gemma 4 LiteRT model suggests the dish, likely ingredients and approximate grams where supported by the image. User review is mandatory. Fields remain editable; changing details clears confirmation. Uncertain weights can stay blank. A rejected/malformed/non-food model response never saves an entry. If recognition cannot run or is stopped, the same review form supports manual entry.

Before saving, choose:

- **Data only:** save the reviewed details and remove Ebb’s photo copy.
- **Keep photo and data:** save a compressed private photo and show its extra storage size.

The choice becomes the default for subsequent photo meals. Editing a saved meal can remove its photo while retaining data. Deleting a meal removes its photo. Cleanup errors are reported and offer retry, and orphaned private photos are cleaned after a successful diary load. A failed diary read does not overwrite records or delete photos. Original gallery pictures are never changed. Ebb-owned ImagePicker cache exports are deleted, including their potential EXIF data; process-death leftovers are cleaned at startup.

## Storage and exports

Meal data is in the existing local diary with backwards-compatible optional fields. Reviewed dish/ingredient weights are estimates, not measurements. JSON exports include meals but strip photo filenames and declare that photos are not embedded. Imports whitelist fields, validate bounds, discard photo references and deduplicate IDs. No model binary, raw model response or meal photo enters a diary backup. Models/photos reside in platform-private storage excluded from OS backup. Data-only saving awaits the diary write before deleting the working photo; photo retention copies the image first and cleans up a failed copy/save. Optional calories/protein/fibre are user-entered label or recipe values, independent of model output. Calories are hidden by default.

## Native inference

Android uses a local Expo module with LiteRT-LM 0.16.1, a compatible Kotlin compiler pin, image input, one session at a time, bounded output/context, disabled thinking/speculative decoding and native resource cleanup. Loading/recognition runs off the UI thread. GPU decoding is attempted first; language decoding can fall back to CPU, but this LiteRT vision path still requires GPU support. Cancellation and app backgrounding prevent late results entering the diary. A deadline stops generation when possible; a native driver blocked inside initialization cannot be force-killed safely. Errors explain manual entry/retry instead of pretending a result exists. No cloud fallback or photo upload is present.

The iOS module currently provides private storage and streaming verification, plus manual meal/photo logging. **iOS AI inference is not enabled.** See IOS_TESTING.md for build/signing status.

## Validation and remaining device checks

Automated tests cover parser bounds and hostile output; explicit confirmation; edited quantities; calorie visibility; meal reload/edit/delete/date navigation; photo-retention choice; export semantics; unreadable diary preservation; and the download/verification/recovery/cancellation state machine. Native hashing is tested with known bytes, multiple chunks and cancellation. Web screenshots were inspected at 390px and 320px.

The APK must still be exercised on the S25 with the actual E2B/E4B download: camera/library permissions, first model load, local photo recognition in airplane mode, accuracy of suggestions on real meals, backgrounding, repeat meals, storage pressure, and update over 1.2. Passing compilation and automated tests is not evidence of measured phone latency, memory use or food recognition accuracy. Keep E2B as the first test; opt for E4B only if the phone runs it comfortably and it reduces corrections.
