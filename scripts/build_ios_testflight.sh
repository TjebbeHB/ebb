#!/bin/bash
# Archives Ebb for the App Store / TestFlight with Xcode's automatic signing
# and either uploads it to App Store Connect or leaves a signed .ipa behind.
#
#   APPLE_TEAM_ID=ABCDE12345 ./scripts/build_ios_testflight.sh
#
# Optional, for unattended upload with an App Store Connect API key
# (App Store Connect → Users and Access → Integrations → Team Keys):
#   ASC_KEY_ID=XXXXXXXXXX ASC_ISSUER_ID=uuid ASC_KEY_PATH=~/keys/AuthKey_XXXXXXXXXX.p8
# Without the key, the script exports releases/ios/Ebb-<version>-<build>.ipa
# for upload with Xcode (Window → Organizer) or the Transporter app.
set -euo pipefail
cd "$(dirname "$0")/.."

if [ -z "${APPLE_TEAM_ID:-}" ]; then
  echo 'Set APPLE_TEAM_ID to your 10-character Apple Developer team id (developer.apple.com → Membership details).' >&2
  exit 1
fi
export DEVELOPER_DIR="${DEVELOPER_DIR:-/Applications/Xcode.app/Contents/Developer}"
export LANG="${LANG:-en_US.UTF-8}"
if [ ! -d "$DEVELOPER_DIR" ]; then
  echo "Xcode was not found at $DEVELOPER_DIR." >&2
  exit 1
fi

version=$(node -p 'require("./app.json").expo.version')
build=$(node -p 'require("./app.json").expo.ios.buildNumber')
out="releases/ios"
archive="build/ios/Ebb-${version}-${build}.xcarchive"
mkdir -p "$out" build/ios

echo "▸ Generating the native iOS project (expo prebuild)"
NODE_ENV=production npx expo prebuild --platform ios --no-install
node scripts/fix_ios_build_paths.cjs
(cd ios && pod install)

auth_args=()
destination="export"
if [ -n "${ASC_KEY_ID:-}" ] && [ -n "${ASC_ISSUER_ID:-}" ] && [ -n "${ASC_KEY_PATH:-}" ]; then
  auth_args=(-authenticationKeyPath "$ASC_KEY_PATH" -authenticationKeyID "$ASC_KEY_ID" -authenticationKeyIssuerID "$ASC_ISSUER_ID")
  destination="upload"
fi

echo "▸ Archiving (automatic signing for team $APPLE_TEAM_ID)"
NODE_ENV=production xcodebuild \
  -workspace ios/Ebb.xcworkspace -scheme Ebb -configuration Release \
  -destination 'generic/platform=iOS' \
  -archivePath "$archive" \
  -allowProvisioningUpdates -allowProvisioningDeviceRegistration \
  "${auth_args[@]}" \
  DEVELOPMENT_TEAM="$APPLE_TEAM_ID" CODE_SIGN_STYLE=Automatic \
  archive

cat > build/ios/ExportOptions.plist <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>method</key><string>app-store-connect</string>
  <key>destination</key><string>${destination}</string>
  <key>teamID</key><string>${APPLE_TEAM_ID}</string>
  <key>signingStyle</key><string>automatic</string>
  <key>uploadSymbols</key><true/>
  <key>manageAppVersionAndBuildNumber</key><false/>
</dict>
</plist>
PLIST

echo "▸ Exporting for App Store Connect ($destination)"
xcodebuild -exportArchive \
  -archivePath "$archive" \
  -exportOptionsPlist build/ios/ExportOptions.plist \
  -exportPath "build/ios/export-${version}-${build}" \
  -allowProvisioningUpdates "${auth_args[@]}"

if [ "$destination" = "export" ]; then
  ipa=$(ls "build/ios/export-${version}-${build}"/*.ipa | head -1)
  cp "$ipa" "$out/Ebb-${version}-${build}.ipa"
  shasum -a 256 "$out/Ebb-${version}-${build}.ipa" > "$out/Ebb-${version}-${build}.ipa.sha256"
  echo "Signed build ready: $out/Ebb-${version}-${build}.ipa"
  echo "Upload it with Xcode (Window → Organizer → Archives → Distribute App) or the Transporter app, then add testers in App Store Connect → TestFlight."
else
  echo "Uploaded to App Store Connect. It appears under TestFlight after processing (usually 5–15 minutes)."
fi
