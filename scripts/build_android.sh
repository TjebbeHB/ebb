#!/bin/bash
# Builds a standalone release APK for personal testing (not Play Store signed).
set -euo pipefail
cd "$(dirname "$0")/.."
export JAVA_HOME="${JAVA_HOME:-/Applications/Android Studio.app/Contents/jbr/Contents/Home}"
export ANDROID_HOME="${ANDROID_HOME:-$HOME/Library/Android/sdk}"
if [ ! -x "$JAVA_HOME/bin/java" ]; then
  echo 'Set JAVA_HOME to an installed Java 17+ runtime.' >&2
  exit 1
fi
version=$(node -p 'require("./app.json").expo.version')
apk="releases/ebb-${version}.apk"
if [ -e "$apk" ]; then
  echo "Refusing to overwrite $apk. Increase the app version first." >&2
  exit 1
fi
export NODE_ENV=production
npx expo prebuild --platform android --no-install
(cd android && ./gradlew app:assembleRelease --no-daemon --max-workers=4 '-Dorg.gradle.jvmargs=-Xmx2048m -XX:MaxMetaspaceSize=1024m')
mkdir -p releases
cp android/app/build/outputs/apk/release/app-release.apk "$apk"
"$JAVA_HOME/bin/java" -jar "$ANDROID_HOME/build-tools/36.0.0/lib/apksigner.jar" verify --verbose "$apk"
shasum -a 256 "$apk" > "${apk}.sha256"
echo "Built $apk"
