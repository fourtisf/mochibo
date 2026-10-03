module.exports = {
  root: true,
  extends: ["next/core-web-vitals", "plugin:@typescript-eslint/recommended"],
  parser: "@typescript-eslint/parser",
  plugins: ["@typescript-eslint"],
  rules: {
    // Character images are pre-rendered WebP or data URLs from the 3D engine, sized by CSS
    // exactly like the prototype. next/image adds wrappers and loaders we do not need here.
    "@next/next/no-img-element": "off",
    "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_", varsIgnorePattern: "^_" }],
  },
};
