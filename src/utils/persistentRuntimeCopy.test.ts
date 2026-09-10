import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DECISION_SUMMARY_COPY,
  DIRECTOR_MODE_EXPLANATION,
  decisionSummaryCopy,
  directorModeExplanation
} from './persistentRuntimeCopy.ts';
import { PERSISTENT_DECISION_SUMMARY_CODES, PERSISTENT_DIRECTOR_MODES } from '../services/persistentService.ts';

test('mode and summaryCode maps are exhaustive for allowlists', () => {
  for (const mode of PERSISTENT_DIRECTOR_MODES) {
    assert.equal(typeof DIRECTOR_MODE_EXPLANATION[mode], 'string');
    assert.ok(directorModeExplanation(mode).length > 0);
  }
  for (const code of PERSISTENT_DECISION_SUMMARY_CODES) {
    assert.equal(typeof DECISION_SUMMARY_COPY[code], 'string');
    assert.ok(decisionSummaryCopy(code).length > 0);
  }
  assert.equal(Object.keys(DIRECTOR_MODE_EXPLANATION).length, PERSISTENT_DIRECTOR_MODES.length);
  assert.equal(Object.keys(DECISION_SUMMARY_COPY).length, PERSISTENT_DECISION_SUMMARY_CODES.length);
});

test('frozen player-facing copy strings match the Wave 4 contract', () => {
  assert.equal(directorModeExplanation('NORMAL'), 'Market running normally.');
  assert.equal(directorModeExplanation('BOOM'), 'The Director is driving a broad upswing.');
  assert.equal(directorModeExplanation('BUST'), 'The Director is applying broad downward pressure.');
  assert.equal(directorModeExplanation('RESCUE'), 'The Director is supporting distressed coins.');
  assert.equal(decisionSummaryCopy('GENESIS_NORMAL'), 'The market opened in a stable state.');
  assert.equal(decisionSummaryCopy('OTHER_SAFE'), 'The Director adjusted market conditions.');
});
