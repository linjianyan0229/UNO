import antfu from '@antfu/eslint-config'

export default antfu({
  vue: true,
  typescript: true,
  ignores: [
    'dist',
    '**/auto-imports.d.ts',
    '**/components.d.ts',
    'src/styles/**',
  ],
  rules: {
    'vue/multi-word-component-names': 'off',
  },
})
