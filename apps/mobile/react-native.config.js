/**
 * Monorepo / RN 0.76 autolinking: the `expo` Android library uses namespace `expo.core` but
 * ExpoModulesPackage lives in `expo.modules`. If expo's react-native.config.js doesn't apply
 * packageImportPath, Gradle generates `import expo.core.ExpoModulesPackage` and javac fails.
 * This override merges (shallow) with expo's dependency config — include ios so we don't drop it.
 */
module.exports = {
  dependencies: {
    expo: {
      platforms: {
        android: {
          packageImportPath: "import expo.modules.ExpoModulesPackage;",
        },
        ios: {},
      },
    },
  },
};
