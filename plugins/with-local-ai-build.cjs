const { withProjectBuildGradle } = require('expo/config-plugins');

// Expo's version catalogue controls stdlib/KSP, but RN also supplies an unversioned
// Kotlin compiler classpath. Pin that compiler to the same version for LiteRT metadata.
module.exports = function withLocalAiBuild(config) {
  return withProjectBuildGradle(config, (result) => {
    if (result.modResults.language !== 'groovy') throw new Error('Ebb local AI expects the Expo Groovy Android build template.');
    const source = result.modResults.contents;
    const line = /classpath\(['"]org\.jetbrains\.kotlin:kotlin-gradle-plugin(?::[^'"]+)?['"]\)/;
    if (!line.test(source)) throw new Error('Could not locate the Kotlin compiler dependency for local meal recognition.');
    result.modResults.contents = source.replace(line, "classpath('org.jetbrains.kotlin:kotlin-gradle-plugin:2.2.21')");
    return result;
  });
};
