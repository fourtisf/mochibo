/* Extends the root config. The override makes `eslint scripts` pick up the .mjs build scripts. */
module.exports = {
  overrides: [{ files: ["*.mjs"] }],
};
