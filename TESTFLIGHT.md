# Inviting testers through TestFlight

Everything Apple needs from the project is prepared. What remains needs your Apple account, so it cannot be scripted. Budget about an hour the first time; later builds take ten minutes.

## Once: accounts and the app record

1. **Apple Developer Program** (99 USD/year): enrol at https://developer.apple.com/programs/enroll/ with your Apple ID. Approval can take a day or two. Note your **Team ID** (10 characters, under Membership details).
2. **Sign Xcode in**: Xcode → Settings → Accounts → + → your Apple ID. This lets Xcode create the signing certificate and provisioning profile automatically.
3. **App record**: https://appstoreconnect.apple.com → Apps → + → New App.
   - Platform iOS, Name `Ebb` (or the final name you pick), primary language English, Bundle ID `app.ebbcycle.ebb` (choose "register a new bundle ID" if it is not listed; Xcode registers it on the first archive too), SKU `ebb-ios`.
   - The bundle identifier is fixed for the life of the app. Change it in `app.json` first if you want something else.
4. Optional but recommended for unattended uploads: App Store Connect → Users and Access → Integrations → Team Keys → generate a key with the **Developer** role. Download the `.p8` once and note the Key ID and Issuer ID.

## Every build

```sh
APPLE_TEAM_ID=YOUR_TEAM_ID ./scripts/build_ios_testflight.sh
```

With the API key, the script uploads the build for you:

```sh
APPLE_TEAM_ID=YOUR_TEAM_ID ASC_KEY_ID=XXXXXXXXXX ASC_ISSUER_ID=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx ASC_KEY_PATH=~/keys/AuthKey_XXXXXXXXXX.p8 ./scripts/build_ios_testflight.sh
```

Without the key, the script leaves `releases/ios/Ebb-1.4.0-5.ipa`. Upload it with the **Transporter** app from the Mac App Store, or open Xcode → Window → Organizer → Archives → Distribute App → TestFlight & App Store.

The script regenerates the native project with Expo, applies the path fix for the space in the folder name, installs pods, archives with automatic signing (Xcode registers the bundle ID and enables HealthKit on the App ID), then exports. Before each new upload, raise `ios.buildNumber` in `app.json`; Apple rejects a build number it has already seen.

Alternative without a Mac build: `npx eas-cli build --platform ios --profile production --auto-submit` uses Expo's cloud builders. Fill in `eas.json` → `submit.production.ios` first. An Expo account is required; the build is free-tier eligible.

## After the upload

1. App Store Connect → your app → **TestFlight**. The build shows "Processing" for 5–15 minutes. Export compliance is answered automatically (`ITSAppUsesNonExemptEncryption = false` in the project).
2. **Internal testers** (fastest, no review): Internal Testing → + → name the group, e.g. "Family". Add people under Users and Access first (role Customer Support or Developer is enough). They get an email and install through the TestFlight app. Up to 100 internal testers.
3. **External testers** (anyone with a link): External Testing → + → group → Add build → fill in the test information from `store/testflight-what-to-test.md` → Submit for Beta App Review. The first build of each version needs Apple's review, usually within a day. Afterwards, share the public link or add emails. Up to 10,000 testers, builds expire after 90 days.
4. Testers install TestFlight from the App Store, open the invitation, tap Install. Feedback and crash reports arrive under TestFlight → Feedback.

## Files you will be asked for

- `store/app-store-listing.md`: name, subtitle, description (the medical disclaimer is in the first paragraph, which Google Play requires and Apple accepts), keywords, category, age rating answers.
- Privacy policy URL: https://tjebbehb.github.io/ebb/privacy.html (source in `docs/privacy.html`; keep `store/privacy-policy.md` in sync). Both stores require a link.
- `store/app-privacy.md`: answers for the App Privacy questionnaire ("Data Not Collected").
- `store/review-notes.md`: notes for App Review explaining HealthKit, camera and photo use, and that no account is needed.
- `store/testflight-what-to-test.md`: the test instructions for external groups.

## What to check on the first device install

The web preview and the unsigned archive prove the code compiles and runs, not how it feels on a phone. On the first TestFlight build, try: Face ID lock, reminders (Settings → Reminders, wait for one), Apple Health import (turn on Flo → Settings → Apple Health first), Flo file import from the Files app, export and share a backup, delete everything, dark mode, and the camera and photo meal entry.
