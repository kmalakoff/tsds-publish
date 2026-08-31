import assert from 'assert';
import publish, { hasChanged } from 'tsds-publish';

describe('exports .ts', () => {
  it('defaults', () => {
    assert.equal(typeof publish, 'function');
    assert.equal(typeof hasChanged, 'function');
  });
});
