import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    files: ['src/**/*.ts'],
    extends: [...tseslint.configs.recommended],
    rules: {
      // Load prompt modules only when an interactive selection is needed.
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['@inquirer/*'],
              message:
                'Use dynamic import() for @inquirer modules to prevent pre-commit hook hangs. See #367.',
            },
          ],
        },
      ],
      // Disable rules that need broader cleanup - focus on critical issues only
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-unused-vars': 'off',
      'no-empty': 'off',
      'prefer-const': 'off',
    },
  },
  {
    ignores: ['dist/**', 'node_modules/**', '*.js', '*.mjs'],
  }
);
