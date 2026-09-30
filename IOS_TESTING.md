# iOS build and device testing

**19 September 2026 (1.4.0 / build 5):** an unsigned Release build for generic iOS device passed again with the splash-screen plugin, the amber icon set, the Flo/Apple Health importers and the push-entitlement removal (`artifacts/ios/release-build-1.4.0.log`). For signing, upload and tester invitations see [TESTFLIGHT.md](TESTFLIGHT.md) and `scripts/build_ios_testflight.sh`.

Checked on 12 September 2026. The primary installation for this update is Android. iOS supports the meal diary, photo retention settings and manual review; the current native module implements model-file storage and verification on iOS, but **does not run food-photo recognition on iOS**.

## Local tools

- Xcode 26.6 (17F113), with iOS 26.5 device and simulator SDKs.
- Xcode's first-launch check succeeds after the user accepted its license.
- CocoaPods 1.17.0 installed through Homebrew, with its Ruby dependency.
- No simulator devices are installed. A generic iOS device build uses the device SDK and does not require downloading a simulator.
- All command-line checks use `DEVELOPER_DIR=/Applications/Xcode.app/Contents/Developer`; the machine's global `xcode-select` setting is unchanged.

## Build status

**Unsigned Release build passed** for generic iOS device, version **1.3.0 / build 4**, using the final native Swift storage/hash implementation. CocoaPods installed 103 pods; Expo's module provider includes `EbbLocalAiModule`. The compiled app is an arm64 Mach-O executable. The final Swift object was rebuilt after the streaming-hash autorelease-pool change.

Build output: `/tmp/ebb-ios-device-build/Build/Products/Release-iphoneos/Ebb.app`. Build log: `artifacts/ios/release-build.log`. The temporary output may be removed by the operating system; rebuild using the commands below when needed.

This checks native compilation and Release JavaScript bundling. It does not establish performance or behavior on an iPhone. An unsigned `.app` is not an installable TestFlight or device distribution.

## Reproducing the local unsigned build

The workspace name contains spaces. Expo Constants 57.0.18 has two shell quoting defects that prevent its app-configuration build phase from running in that path, and Expo's generated bundle phase also executes an unquoted script path. `scripts/fix_ios_build_paths.cjs` applies narrowly matched, idempotent fixes; it must run after dependency installation and Expo prebuild, before `pod install`. It also escapes an explicitly configured project-root value. The script stops with an explanation if upstream code has changed and needs review.

From the project root:

```sh
export DEVELOPER_DIR=/Applications/Xcode.app/Contents/Developer
npx expo prebuild --platform ios --no-install
node scripts/fix_ios_build_paths.cjs
cd ios
pod install
cd ..
NODE_ENV=production xcodebuild \
  -workspace ios/Ebb.xcworkspace -scheme Ebb -configuration Release \
  -destination 'generic/platform=iOS' \
  -derivedDataPath /tmp/ebb-ios-device-build -jobs 2 \
  CODE_SIGNING_ALLOWED=NO CODE_SIGNING_REQUIRED=NO build
```

Prebuild regenerates the generated iOS project. Preserve any future manual signing/project changes before regenerating it. Open `ios/Ebb.xcworkspace`, rather than the `.xcodeproj`, after CocoaPods has installed dependencies.

## Installing on an iPhone and using TestFlight

The project uses bundle identifier `app.ebbcycle.ebb`. No development team is configured in the project. Open the generated `ios/Ebb.xcworkspace` after CocoaPods installation, select the Ebb target, and select the intended Apple development team under Signing & Capabilities. The app includes HealthKit, so the team's provisioning must support the app's entitlements. A connected phone also needs to trust the Mac and have the required development settings enabled.

For TestFlight, Apple requires Apple Developer Program membership and an App Store Connect app record. After signing is configured, create a Release archive in Xcode, validate it, and upload it to App Store Connect. Add testers once processing finishes. External testing requires TestFlight review. Installing the TestFlight app alone does not create or sign an Ebb build. [Apple distribution guidance](https://developer.apple.com/documentation/xcode/distributing-your-app-for-beta-testing-and-releases), [Apple TestFlight guidance](https://developer.apple.com/testflight/).

No signing certificates, provisioning profiles, team selection, App Store Connect record or TestFlight upload were created as part of the local unsigned build check.

Before an iOS test release, verify photo picking/capture on a real iPhone, data-only photo cleanup, retained-photo deletion, cold-start model-file detection, local authentication, HealthKit permissions, meal export/import and all-data deletion. iOS image inference still needs a separate native implementation and device validation.
