/** @type {import('jest').Config} */
export default {
    testEnvironment: 'node',
    transform: {},
    coverageDirectory: 'coverage',
    coverageThreshold: {
        global: {
            branches: 80,
            functions: 85,
            lines: 90,
            statements: 90,
        },
    },
};
