// Test-only bridge to Node's built-in test runner and strict assertions.
//
// The application TypeScript project (tsconfig.app.json, include: src)
// has no @types/node, so a direct `import 'node:test'` in a src test file
// is an unresolved-module diagnostic. Plain JavaScript is not part of that
// project (allowJs is off); the sibling nodeTestRunner.d.ts declares the
// exact subset of the API the tests use, so test files importing this
// bridge type-check cleanly without adding Node globals to the app.
// Never imported by application code.
export { default as test } from 'node:test';
export { default as assert } from 'node:assert/strict';
