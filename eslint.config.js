import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import prettier from 'eslint-config-prettier';
import globals from 'globals';

export default tseslint.config(
  { ignores: ['**/dist/**', '**/node_modules/**'] },
  js.configs.recommended,
  tseslint.configs.recommended,
  prettier,
  {
    files: ['apps/web/**/*.{ts,tsx}'],
    languageOptions: { globals: globals.browser },
  },
  {
    files: ['apps/server/**/*.ts', '*.config.ts'],
    languageOptions: { globals: globals.node },
  },
  // El motor debe ser determinista y sin dependencias (PLAN.md §2 y §12).
  {
    // Los tests navegan respuestas JSON sueltas; tiparlas no aporta nada.
    files: ['**/*.test.ts'],
    rules: { '@typescript-eslint/no-explicit-any': 'off' },
  },
  {
    // `const { campo: _fuera, ...resto } = obj` es la forma de quitar un campo.
    // Sin esto, ESLint marca la variable que existe justo para no usarse.
    rules: {
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_', ignoreRestSiblings: true },
      ],
    },
  },
  {
    files: ['packages/engine/**/*.ts'],
    ignores: ['packages/engine/**/*.test.ts'],
    rules: {
      'no-restricted-globals': [
        'error',
        { name: 'Date', message: 'El motor debe ser determinista: sin reloj.' },
        { name: 'performance', message: 'El motor debe ser determinista: sin reloj.' },
      ],
      'no-restricted-properties': [
        'error',
        { object: 'Math', property: 'random', message: 'Usa el PRNG con semilla.' },
        { object: 'crypto', property: 'getRandomValues', message: 'Usa el PRNG con semilla.' },
      ],
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              // Cualquier especificador que no empiece por "." es externo.
              regex: '^[^.]',
              message: 'El motor no importa nada externo: solo rutas relativas.',
            },
          ],
        },
      ],
    },
  },
);
