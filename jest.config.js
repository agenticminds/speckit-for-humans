/** @type {import('jest').Config} */
module.exports = {
    preset: 'ts-jest',
    testEnvironment: 'node',
    roots: ['<rootDir>/src'],
    testMatch: [
        '**/__tests__/**/*.test.ts',
        '**/*.test.ts'
    ],
    moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json', 'node'],
    collectCoverageFrom: [
        'src/**/*.ts',
        '!src/**/*.d.ts',
        '!src/**/__tests__/**',
        // Exclude files that depend heavily on VS Code API (tested via integration tests)
        '!src/extension.ts',
        '!src/editor/MarkdownEditorProvider.ts',
        // Export pipeline depends on VS Code UI + external binaries (Chrome/Word); covered via manual/integration testing.
        '!src/features/documentExport.ts',
        '!src/webview/**'
    ],
    coverageThreshold: {
        global: {
            branches: 60,
            functions: 60,
            lines: 60,
            statements: 60
        }
    },
    coverageReporters: ['text', 'lcov', 'html'],
    // Mock VS Code and other modules for unit tests
    moduleNameMapper: {
        '^vscode$': '<rootDir>/src/__mocks__/vscode.ts',
        '^mermaid$': '<rootDir>/src/__mocks__/mermaid.ts',
        '\\.(css|less|scss)$': '<rootDir>/src/__mocks__/styleMock.ts'
    },
    setupFiles: ['<rootDir>/src/__tests__/setup.ts'],
    setupFilesAfterEnv: ['<rootDir>/src/__tests__/setup-after-env.ts'],
    verbose: true,
    // Fail tests on console warnings/errors to catch issues early
    silent: false,

    // Corrects a deadline; does NOT mask a leak.
    //
    // Jest was intermittently printing "A worker process has failed to exit
    // gracefully and has been force exited" on roughly 4 of 6 runs. It was
    // investigated as a leaked handle and is not one:
    //   - process._getActiveHandles() at the end of all suites shows only the
    //     worker's own 2 stdio sockets and 1 IPC pipe. No test-created handles.
    //   - --detectOpenHandles on a full in-band run reports nothing.
    //   - Instrumenting jest-worker's end() showed every worker's event loop
    //     drains 12-31ms after it receives CHILD_MESSAGE_END, but the parent
    //     observed those exits at 1114-1158ms and flagged all 11 as forced.
    //   - Clean at --maxWorkers<=5, warns at >=6. Clean at >=2000ms here.
    //
    // jest-worker defaults this to 500ms, which is not enough time to reap 11
    // workers (200-300MB RSS each) terminating at once. Two genuine timer
    // leaks WERE found during that investigation and fixed separately in
    // src/webview/features/auditDocument.ts and src/webview/editor.ts.
    workerGracefulExitTimeout: 2000
};
