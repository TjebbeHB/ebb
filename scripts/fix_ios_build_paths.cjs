const fs = require('node:fs');
const path = require('node:path');

// Expo Constants 57.0.18 splits space-containing project paths in two places.
// Keep this targeted and idempotent until the upstream scripts quote those paths.
const root = path.resolve(__dirname, '..');
function patch(file, before, after) {
  const target = path.join(root, file);
  const source = fs.readFileSync(target, 'utf8');
  if (source.includes(after)) return;
  if (!source.includes(before)) throw new Error(`Review the iOS path fix for ${file}: the upstream script changed.`);
  fs.writeFileSync(target, source.replace(before, after));
}
const podspec = 'node_modules/expo-constants/ios/EXConstants.podspec';
patch(podspec, "require 'json'", "require 'json'\nrequire 'shellwords'");
patch(podspec,
  `env_vars = ENV['PROJECT_ROOT'] ? "PROJECT_ROOT=#{ENV['PROJECT_ROOT']} " : ""`,
  `env_vars = ENV['PROJECT_ROOT'] ? "PROJECT_ROOT=#{Shellwords.escape(ENV['PROJECT_ROOT'])} " : ""`);
patch(podspec,
  String.raw`:script => "bash -l -c \"#{env_vars}$PODS_TARGET_SRCROOT/../scripts/get-app-config-ios.sh\"",`,
  String.raw`:script => "#{env_vars}bash -l \"$PODS_TARGET_SRCROOT/../scripts/get-app-config-ios.sh\"",`);
patch('node_modules/expo-constants/scripts/get-app-config-ios.sh',
  'PROJECT_DIR_BASENAME=$(basename $PROJECT_DIR)',
  'PROJECT_DIR_BASENAME=$(basename "$PROJECT_DIR")');

// The generated Expo template also executes an unquoted command substitution
// for the React Native bundle script. Patch the phase after Expo prebuild.
const projectPath = path.join(root, 'ios/Ebb.xcodeproj/project.pbxproj');
if (fs.existsSync(projectPath)) {
  const project = require('xcode').project(projectPath);
  project.parseSync();
  const phases = Object.values(project.hash.project.objects.PBXShellScriptBuildPhase);
  const phase = phases.find((item) => typeof item === 'object' && item.name === '"Bundle React Native code and images"');
  if (!phase) throw new Error('Review the iOS bundle phase path fix: the generated template changed.');
  const script = JSON.parse(phase.shellScript);
  const invocation = script.split('\n').find((line) => line.includes("'/scripts/react-native-xcode.sh'"));
  if (!invocation) throw new Error('Review the iOS bundle script invocation: the generated template changed.');
  if (invocation.startsWith('`') && invocation.endsWith('`')) {
    const quoted = '"$(' + invocation.slice(1, -1) + ')"';
    phase.shellScript = JSON.stringify(script.replace(invocation, quoted));
    fs.writeFileSync(projectPath, project.writeSync());
  } else if (!(invocation.startsWith('"$(') && invocation.endsWith(')"'))) {
    throw new Error('Review the iOS bundle script quoting: the generated template changed.');
  }
}
console.log('Expo iOS build scripts now preserve project paths containing spaces.');
