// noinspection NpmUsedModulesInstalled
import globals from 'globals';
import babelParser from '@babel/eslint-parser';
// noinspection NpmUsedModulesInstalled
import typescriptPlugin from '@typescript-eslint/eslint-plugin';
// noinspection NpmUsedModulesInstalled
import tsParser from '@typescript-eslint/parser';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
// noinspection NpmUsedModulesInstalled
import js from '@eslint/js';
// noinspection NpmUsedModulesInstalled
import { FlatCompat } from '@eslint/eslintrc';
import jest from 'eslint-plugin-jest';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const compat = new FlatCompat({
    baseDirectory: __dirname,
    recommendedConfig: js.configs.recommended,
    allConfig: js.configs.all
});

// noinspection JSUnresolvedReference
export default [{
    ignores: ['**/dist', '**/node_modules'],
}, {
    files: ['spec/**'],
    ...jest.configs['flat/recommended'],
    rules: {
        ...jest.configs['flat/recommended'].rules,
        'jest/prefer-expect-assertions': 'off',
    },
}, ...compat.extends('eslint:recommended'), {
    languageOptions: {
        globals: {
            ...globals.node
        },
        parser: babelParser,
    },
    rules: {
        'no-console': 'off',
        'no-invalid-this': 'warn',
        'no-undef': 'error',
        'no-unused-vars': 'warn',
        'no-var': ['error'],
        quotes: ['error', 'single'],
        strict: [2, 'never'],
    },
}, ...compat.extends(
    'eslint:recommended',
    'plugin:@typescript-eslint/eslint-recommended',
    'plugin:@typescript-eslint/recommended',
).map(config => ({
    ...config,
    files: ['src/**/*.d.ts'],
})), {
    files: ['src/**/*.d.ts'],
    plugins: {
        '@typescript-eslint': typescriptPlugin,
    },
    rules: {
        '@typescript-eslint/no-explicit-any': 'off',
    },
    languageOptions: {
        parser: tsParser,
    },
}];