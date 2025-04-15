const { getDefaultConfig } = require("@expo/metro-config");

const config = getDefaultConfig(__dirname);

// ❌ 불필요한 polyfill 제거
// ✅ 최신 Expo 프로젝트에선 기본 설정만으로 충분
module.exports = config;
