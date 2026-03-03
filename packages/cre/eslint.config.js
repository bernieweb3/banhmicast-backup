/** @type {import('eslint').Linter.Config} */
export default {
    env: {
        es2022: true,
        node: true,
        jest: true,
    },
    parserOptions: {
        ecmaVersion: 2022,
        sourceType: 'module',
    },
    rules: {
        'no-var': 'error',
        'prefer-const': 'error',
        'no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
        'eqeqeq': ['error', 'always'],
        'no-eval': 'error',
        'no-implied-eval': 'error',
    },
};
