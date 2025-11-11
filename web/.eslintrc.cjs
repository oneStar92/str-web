module.exports = {
  root: true,
  env: {
    browser: true,
    es2023: true,
  },
  extends: ['eslint:recommended', 'plugin:react-hooks/recommended'],
  parserOptions: {
    ecmaVersion: 'latest',
    sourceType: 'module',
  },
  rules: {},
};
