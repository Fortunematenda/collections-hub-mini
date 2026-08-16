import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mergeById, preferPromise } from './store-merge.js';

test('client deletes persist when keepServerOnly is off', () => {
  const merged = mergeById([{ id: 'a' }, { id: 'b' }], [{ id: 'a', name: 'kept' }]);
  assert.deepEqual(
    merged.map((item) => item.id),
    ['a'],
  );
});

test('keeps server-only promises so jobs are not overwritten', () => {
  const merged = mergeById(
    [
      { id: 'p1', status: 'Pending' },
      { id: 'p2', status: 'Broken', outcome: 'Date passed with no payment' },
    ],
    [{ id: 'p1', status: 'Pending' }],
    preferPromise,
    { keepServerOnly: true },
  );
  assert.equal(merged.length, 2);
  assert.equal(merged.find((item) => item.id === 'p2')?.status, 'Broken');
});

test('server broken status wins over a stale pending client copy', () => {
  const merged = preferPromise(
    { id: 'p1', status: 'Broken', outcome: 'Date passed with no payment' },
    { id: 'p1', status: 'Pending', customerComment: 'will pay' },
  );
  assert.equal(merged.status, 'Broken');
  assert.equal(merged.customerComment, 'will pay');
});
