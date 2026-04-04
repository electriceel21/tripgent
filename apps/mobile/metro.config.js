// Monorepo: ensure Metro can see the workspace root (pnpm hoists deps to repo root).
// Helps EAS when project lives under apps/mobile.
const { getDefaultConfig } = require("expo/metro-config");
const path = require("path");

const projectRoot = __dirname;
const monorepoRoot = path.resolve(projectRoot, "../..");

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(projectRoot);

const folders = new Set([...(config.watchFolders ?? []), monorepoRoot]);
config.watchFolders = [...folders];

const appNm = path.resolve(projectRoot, "node_modules");
const rootNm = path.resolve(monorepoRoot, "node_modules");
config.resolver.nodeModulesPaths = [
  appNm,
  ...(config.resolver.nodeModulesPaths ?? []).filter(
    (p) => p !== appNm && p !== rootNm
  ),
  rootNm,
];

module.exports = config;
