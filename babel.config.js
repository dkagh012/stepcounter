module.exports = function (api) {
  api.cache(true);
  return {
    presets: ["babel-preset-expo"],
    plugins: [
      // ⚠️ module-resolver를 쓰고 싶으면 여기에 원하는 alias를 추가하세요.
      [
        "module-resolver",
        {
          alias: {
            // 예시: 내 폴더를 쉽게 import 하고 싶을 때
            "@components": "./src/components",
            "@screens": "./src/screens",
          },
        },
      ],
    ],
  };
};
