# Ebb food-photo prototype — research and decisions

Historical research for 1.2.0; see FOOD_LOGGING.md for the implemented 1.3.0 flow.

Reviewed 12 September 2026. Target phones: Samsung Galaxy S25 and likely iPhone 14. User preference: meal diary and nutrient estimates, with calories optional.

## What is implemented in 1.2.0

Today now offers offline food and movement guidance, plus a whole-month explorer with meal examples. Today’s logged energy, pain, disruption, fatigue and sleep quality can soften the movement suggestion; stage estimates do not force training intensity. Hormonal settings, missing cycle history and uncertain dates use everyday suggestions. A positive pregnancy test logged today pauses phase suggestions for that day. This is editorial guidance with transparent rules, not a language model or medical assessment.

Settings → Food AI offers independent downloads for Gemma 4 E2B and E4B on native Android/iOS. These are preparatory files: **there is no food recognition or meal logging in this build**. Both are opt-in; neither is bundled in the APK. The catalogue pins full multimodal LiteRT bundles to specific publisher revisions and SHA-256 checksums. The manager checks storage, shows progress, streams verification in bounded chunks, supports stopping and deletion, and prevents incomplete files from becoming available. Files live in reclaimable app cache and stay out of diary exports. Delete all data also removes model files. Web explains that native downloads are unavailable.

Limitations: downloads run in the foreground and interrupted transfers restart. Reopening the model screen verifies existing files, which takes time for multi-GB files. Native transfer and inference performance still need real-device testing; a compiled APK and tests with simulated transfers do not establish that either phone can run either model. No camera permission, cloud inference, automatic dietary targets or model-generated advice is included.

## Evidence behind the guidance

An exercise systematic review found small average phase effects with substantial variation and low-quality evidence; it supports individual decisions rather than a universal phase-based training prescription. Ebb therefore gives familiar-workout options when energy is good, including during bleeding, and lets current discomfort override phase. [McNulty et al., Sports Medicine, 2020](https://pubmed.ncbi.nlm.nih.gov/32661839/).

ACOG describes regular activity, sleep and dietary approaches as possible support for PMS. Ebb suggests wholegrains, beans and calcium-containing foods without promising symptom relief or assigning a restrictive phase diet. [ACOG PMS guidance](https://www.acog.org/womens-health/faqs/premenstrual-syndrome).

NIH describes iron-containing foods and vitamin C’s role in absorption of plant iron. Ebb offers food pairings, not supplement doses or a diagnosis of deficiency. [NIH iron factsheet](https://ods.od.nih.gov/factsheets/Iron-Consumer/). Comfort ideas and the prompt to seek help for disruptive/severe pain follow [NHS period-pain guidance](https://www.nhs.uk/symptoms/period-pain/).

## Which model, and why?

| Candidate | Exact download size | First phone to test | Decision rule |
| --- | ---: | --- | --- |
| Gemma 4 E2B, full mobile bundle | 2,588,147,712 bytes / 2.59 GB | iPhone 14, then S25 | Preferred if recognition and correction burden are acceptable |
| Gemma 4 E4B, full mobile bundle | 3,659,530,240 bytes / 3.66 GB | S25 | Keep only if it meaningfully improves food recognition |

File sizes and checksums were read from the publisher’s file API; see the pinned catalogue in `src/logic/modelCatalog.ts`. [E2B publisher bundle](https://huggingface.co/litert-community/gemma-4-E2B-it-litert-lm), [E4B publisher bundle](https://huggingface.co/litert-community/gemma-4-E4B-it-litert-lm).

Download size, effective parameter count and peak app RAM are different quantities. Google lists approximate mobile static-weight footprints of 1.1 GB for E2B and 2.5 GB for E4B, while noting additional runtime and context costs. These are not iPhone 14 or S25 food-photo measurements. Mobile quantization and memory-mapped embeddings are reasons to evaluate LiteRT first. [Gemma model overview](https://ai.google.dev/gemma/docs/core).

LiteRT-LM’s Kotlin API is stable; its Swift API is early preview in the repository reviewed. A React Native app needs a native bridge and device/lifecycle validation. A Swift integration path exists, so iOS is feasible in principle; it is not already verified in Ebb. [LiteRT-LM repository](https://github.com/google-ai-edge/LiteRT-LM), [Swift integration](https://developers.google.com/edge/litert-lm/swift).

A second candidate is llama.rn, which exposes image understanding through a matching model and multimodal projector and supports Metal on iOS. Its GGUF files are a different format: the LiteRT downloads in this build cannot simply be loaded into it. Compare it only if the LiteRT bridge is unstable on the target iPhone. [llama.rn documentation](https://github.com/mybigday/llama.rn).

## Proposed meal flow

1. Take a photo or choose one; keep a manual entry option.
2. Resize a private working copy, remove location metadata and ask the local model for a short list of visible foods. Do not send cycle logs to the model.
3. Show editable candidates: “Rice, chickpeas, vegetables?” Allow “not sure” instead of inventing ingredients.
4. For a simple diary, save the confirmed meal with no required portion entry.
5. For nutrition estimates, ask for portions and relevant additions such as oil or sauce. Match confirmed foods to a local nutrient database and calculate from entered amounts. Let the user enter package-label values when available.
6. Keep calorie display off by default, with a separate opt-in. Protein, fibre and other requested nutrients can be shown independently. Incomplete meals must show incomplete estimates; absent values are not zero.
7. Save repeated meals and recent foods so the model is unnecessary for routine entries.

Photo-based dietary assessment struggles with quantity, cooking methods and ingredients that are not visible. One photo cannot establish precise nutrition or whether food is allergen-free. This is why confirmation belongs in the proposed flow. [Dietary image assessment review, JMIR 2024](https://www.jmir.org/2024/1/e51432).

USDA provides downloadable nutrient datasets. A curated local subset plus a search index is a practical starting point; the app does not need the full branded-food corpus in its base installation. Regional coverage and food identifiers need checking against your usual meals. [USDA downloadable data](https://fdc.nal.usda.gov/download-datasets/).

## Efficiency choices to test

These are design proposals, not measured outcomes:

- Start with E2B and expose E4B as an explicit alternative. Do not auto-download both or choose solely from the phone’s total RAM.
- Load one model only when a photo needs analysis. Use a bounded image/token budget and a short structured response; disable optional reasoning output for this recognition task if the runtime supports it.
- Run native work off the UI thread. Support cancellation and unload on memory pressure/backgrounding. Measure whether a short warm window helps repeated photos without holding memory for the whole diary session.
- Keep recognition separate from nutrition arithmetic and cycle guidance. A language model should not fabricate exact calories, deficiencies, hormone levels or personalised supplement advice.
- No automatic cloud fallback. If a phone cannot run the model, the photo/manual diary still works.
- Before wider release, add resumable downloads and cache verified-file receipts to avoid unnecessary repeat hashing. The initial manager favors explicit verification and clean cancellation.

## Useful insights later

Start with descriptive patterns: regularity of meals, logged hunger or energy alongside sleep and cycle stage, and recurring symptom associations over several cycles. Display observation counts, allow missing meals, and distinguish association from causation. Avoid labelling foods “bad for this phase”, ranking dietary virtue, or assuming an unlogged meal was skipped. Optional nutrient tracking should not silently introduce weight-loss targets or calorie budgets.

## Device trial before enabling recognition

Use the same small consented set of everyday meals on both phones: simple plates, mixed bowls, soups, sauces, packaged foods and leftovers. Include ambiguous/non-food pictures. Measure correct food candidates, missed ingredients, number of corrections, invalid structured responses, cold-load time, photo-to-result latency, peak app memory, temperature and battery use across repeated runs. Record model revision, runtime version and image settings. Test airplane mode, app backgrounding, cancellation, interrupted downloads, full storage and low-memory termination.

Proposed acceptance criteria should be chosen with you after seeing a baseline; no invented accuracy percentage or latency promise is appropriate yet. E4B earns its extra storage only if it reduces corrections enough to matter. The next product choice is whether the main Food screen should emphasize the visual meal diary or nutrient detail; both can coexist with calories hidden.

## Validation of this update

TypeScript passes; 33 unit tests and 14 browser app-flow tests pass. The download tests use injected transfers to cover corruption, incomplete/failed responses, disk limits, cancellation, duplicate starts, process-death leftovers and deletion. Both pinned publisher URLs returned successful HTTP range responses with the expected total file sizes. The release APK builds as version 1.2.0 / code 3, uses the same signing certificate as 1.1.0, and its source map was checked against the final guidance and downloader sources. Layouts were visually reviewed at 320px and 390px. No Android device was attached; full multi-GB native downloads, runtime performance and iOS builds remain untested on hardware.
