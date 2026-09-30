# Ebb health connections

Implemented September 11, 2026. Open **Settings → Health** in an installed Ebb build.

## Connection route

- Android: compatible watch/wristband → its companion app → Health Connect → Ebb.
- iPhone: Apple Watch or compatible wristband → Apple Health → Ebb.
- A Wear OS watch is not an iOS integration standard. Phone/watch compatibility and the measurements a companion app shares vary by manufacturer.
- Ebb does not pair over Bluetooth, run on a watch, access a vendor account, or use a cloud health connector.
- The connector tools exposed in this Codex session were checked. None exposes Apple Health, Health Connect, Wear OS, Fitbit, Garmin or Oura data. The session has no callable plugin-directory search, so this is not a claim about every plugin that might exist. Installing a Codex fitness plugin would not add a native integration to a shipped app.

## Permissions and data handling

Only read access to sleep and resting heart rate is requested. Sync is foreground/manual. Android requires read permissions for `SleepSession` and `RestingHeartRate`; iOS requests `HKCategoryTypeIdentifierSleepAnalysis` and `HKQuantityTypeIdentifierRestingHeartRate`. No write scopes, step counts, location, temperature, reproductive health records, background reading, analytics, vendor credentials or backend are requested.

Each successful read replaces the locally stored snapshot with up to 28 calendar days, even when no data is returned. A failed read preserves the previous snapshot. Android supports partial read grants. Apple intentionally conceals whether read access was denied; an empty query is not represented as a verified connection. HealthKit authorization completion is never used as evidence of read permission.

The snapshot is separate from diary entries. Manual sleep overrides imported sleep in analysis. Missing measurements are unknown, not zero. Only actual asleep stages count: unknown/in-bed/awake intervals are excluded. Overlaps are unioned, and stages separated by at most three hours are grouped into an episode, attributed to its local wake-up day. This heuristic can differ from a vendor’s nightly total; records without asleep stages do not yield a sleep duration. Resting heart rate is the daily median of returned samples. Ebb does not expose source-priority selection and does not claim clinical accuracy.

Imported data includes the platform source and last-read time. **Remove imported data** deletes Ebb’s snapshot; system read access is revoked separately in the health app. No further reads occur without tapping sync. JSON backups include health imports; diary CSV and appointment reports do not. Delete-all removes the local snapshot too. Android automatic cloud backup is disabled. The Health Connect privacy-policy intent opens a dedicated screen, including before onboarding or when Ebb is locked.

## Build and verification

- Uses `react-native-health-connect` 4.1.3, `@kingstinct/react-native-healthkit` 15.1.0 and Nitro 0.37.1 (resolved versions in package-lock.json).
- Health features require a custom native build; Expo Go and browser previews show an unavailable state.
- App minimum Android version is now API 26 (Android 8). Health Connect availability is checked at runtime; Health Connect requires a supported Android phone and may need installation/update on older supported systems.
- Config plugins (including the local privacy plugin, which replaces the library’s default main-activity rationale route) generate read permissions, the HealthKit entitlement, purpose text, and Android privacy intent/activity. Apple background delivery is disabled.
- Android HealthKit/Nitro autolinking is disabled because those dependencies are only needed on iOS.
- Native health import still needs hardware acceptance testing. No phone or watch was attached to the development workspace. An iOS native build requires Xcode and signing, which are not available here.

Before release, test both granted scopes, each partial grant, denial, revoked access, empty health stores, re-sync after source deletion, overlapping sleep records, cross-midnight sleep, daylight saving changes, removing imports, and a JSON backup round trip on real devices. Confirm Health Connect privacy intents on Android 13 and 14+, and review the store’s health-data declarations and public privacy-policy requirements.

## Sources

- [Android Health Connect overview](https://developer.android.com/health-and-fitness/health-connect)
- [Android data types and read permissions](https://developer.android.com/health-and-fitness/health-connect/data-types)
- [Android raw-data reading and pagination](https://developer.android.com/health-and-fitness/health-connect/read-data)
- [Android aggregate deduplication behavior](https://developer.android.com/health-and-fitness/health-connect/aggregate-data)
- [React Native Health Connect setup](https://matinzd.github.io/react-native-health-connect/docs/get-started/)
- [Apple HealthKit authorization](https://developer.apple.com/documentation/healthkit/authorizing-access-to-health-data)
- [HealthKit library implementation and Expo plugin](https://github.com/kingstinct/react-native-healthkit)
