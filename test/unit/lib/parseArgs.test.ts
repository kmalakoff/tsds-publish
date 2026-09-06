import assert from 'assert';

import { parseArgs } from 'tsds-publish';

describe('parseArgs', () => {
  describe('version', () => {
    it('should default to patch', () => {
      assert.equal(parseArgs([]).version, 'patch');
    });

    it('should use the version increment argument', () => {
      assert.equal(parseArgs(['minor']).version, 'minor');
      assert.equal(parseArgs(['major']).version, 'major');
    });

    it('should keep the version increment when --tag is provided', () => {
      assert.equal(parseArgs(['minor', '--tag', 'support-1']).version, 'minor');
      assert.equal(parseArgs(['--tag', 'support-1', 'minor']).version, 'minor');
    });
  });

  describe('publish arguments', () => {
    it('should publish with no extra arguments by default', () => {
      assert.deepEqual(parseArgs(['minor']).publishArgs, ['publish']);
    });

    it('should forward --dry-run', () => {
      assert.deepEqual(parseArgs(['minor', '--dry-run']).publishArgs, ['publish', '--dry-run']);
    });

    it('should forward --otp', () => {
      assert.deepEqual(parseArgs(['minor', '--otp', '123456']).publishArgs, ['publish', '--otp=123456']);
    });

    it('should forward --tag', () => {
      assert.deepEqual(parseArgs(['minor', '--tag', 'support-1']).publishArgs, ['publish', '--tag=support-1']);
    });

    it('should forward --tag before the version increment', () => {
      assert.deepEqual(parseArgs(['--tag', 'support-1', 'minor']).publishArgs, ['publish', '--tag=support-1']);
    });

    it('should forward --tag=value', () => {
      assert.deepEqual(parseArgs(['minor', '--tag=support-1']).publishArgs, ['publish', '--tag=support-1']);
    });

    it('should forward --tag with --dry-run and --otp', () => {
      assert.deepEqual(parseArgs(['minor', '--dry-run', '--otp', '123456', '--tag', 'support-1']).publishArgs, ['publish', '--dry-run', '--otp=123456', '--tag=support-1']);
    });
  });

  describe('flags', () => {
    it('should parse --yolo and --dry-run', () => {
      const opts = parseArgs(['minor', '--yolo', '--dry-run']);
      assert.equal(opts.yolo, true);
      assert.equal(opts.dryRun, true);
      assert.equal(parseArgs(['minor']).yolo, false);
      assert.equal(parseArgs(['minor']).dryRun, false);
    });
  });
});
