// Types for the test-only node:test / node:assert/strict bridge
// (nodeTestRunner.js). Only the subset used by src unit tests is declared;
// signatures follow Node's own strict-mode assert contracts.

export type TestBody = () => void | Promise<void>;

export declare function test(name: string, fn: TestBody): Promise<void>;

export interface StrictAssert {
  equal(actual: unknown, expected: unknown, message?: string): void;
  notEqual(actual: unknown, expected: unknown, message?: string): void;
  deepEqual(actual: unknown, expected: unknown, message?: string): void;
  match(value: string, regExp: RegExp, message?: string): void;
  ok(value: unknown, message?: string): asserts value;
  throws(block: () => unknown, error?: RegExp | (new (...args: never[]) => Error) | object, message?: string): void;
}

export declare const assert: StrictAssert;
