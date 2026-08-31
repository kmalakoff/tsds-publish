const assert = require('assert');
const publish = require('tsds-publish');

describe('exports .cjs', () => {
  it('defaults', () => {
    assert.equal(typeof publish, 'function');
    assert.equal(typeof publish.hasChanged, 'function');
  });
});
