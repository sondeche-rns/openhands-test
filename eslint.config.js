import js from '@eslint/js'

export default [
  js.configs.recommended,
  {
    files: ["web/**/*.js","web/**/*.mjs","tests/**/*.mjs"],
    languageOptions: {
      ecmaVersion: 2021,
      sourceType: 'module',
      globals: {
        window: 'readonly', document: 'readonly', console: 'readonly', fetch:'readonly', Blob:'readonly', URL:'readonly', DOMParser:'readonly', FileReader:'readonly', alert:'readonly', process:'readonly'
      }
    },
    rules: {
      'no-unused-vars': ['warn', {args:'after-used', ignoreRestSiblings:true}],
      'no-undef': 'error',
      'no-useless-escape': 'off'
    }
  }
]
