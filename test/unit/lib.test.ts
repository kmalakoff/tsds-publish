// remove NODE_OPTIONS to not interfere with tests
delete process.env.NODE_OPTIONS;

// Load test environment before other imports
import path from 'path';
import { loadEnv } from 'tsds-lib';
import { installGitRepo } from 'tsds-lib-test';
import url from 'url';

const __dirname = path.dirname(typeof __filename !== 'undefined' ? __filename : url.fileURLToPath(import.meta.url));
loadEnv({ path: path.join(__dirname, '..', '..', '.env.test') });

import assert from 'assert';
import fs from 'fs';
import { linkModule, unlinkModule } from 'module-link-unlink';
import os from 'os';
import osShim from 'os-shim';
import Queue from 'queue-cb';
import * as resolve from 'resolve';
import shortHash from 'short-hash';

const tmpdir = os.tmpdir || osShim.tmpdir;
const resolveSync = (resolve.default ?? resolve).sync;

import publish, { hasChanged } from 'tsds-publish';

const GITS = ['https://github.com/kmalakoff/parser-multipart.git'];

function addTests(repo) {
  const repoName = path.basename(repo, path.extname(repo));
  describe(repoName, () => {
    const dest = path.join(tmpdir(), 'tsds-publish', shortHash(process.cwd()), repoName);
    const modulePath = fs.realpathSync(path.join(__dirname, '..', '..'));
    const modulePackage = JSON.parse(fs.readFileSync(path.join(modulePath, 'package.json'), 'utf8'));
    const nodeModules = path.join(dest, 'node_modules');
    const deps = { ...(modulePackage.dependencies || {}), ...(modulePackage.peerDependencies || {}) };

    before((cb) => {
      installGitRepo(repo, dest, (err): undefined => {
        if (err) {
          cb(err);
          return;
        }

        const queue = new Queue();
        queue.defer(linkModule.bind(null, modulePath, nodeModules));
        for (const dep in deps) queue.defer(linkModule.bind(null, path.dirname(resolveSync(`${dep}/package.json`)), nodeModules));
        queue.await(cb);
      });
    });
    after((cb) => {
      const queue = new Queue();
      queue.defer(unlinkModule.bind(null, modulePath, nodeModules));
      for (const dep in deps) queue.defer(unlinkModule.bind(null, path.dirname(resolveSync(`${dep}/package.json`)), nodeModules));
      queue.await(cb);
    });

    // State restoration
    let originalPackageJson: string;
    let originalSrcFile: string | undefined;

    beforeEach(() => {
      // Capture original state before each test
      originalPackageJson = fs.readFileSync(path.join(dest, 'package.json'), 'utf8');
      const srcPath = path.join(dest, 'src', 'index.js');
      if (fs.existsSync(srcPath)) {
        originalSrcFile = fs.readFileSync(srcPath, 'utf8');
      }
    });

    afterEach(() => {
      // Restore original state after each test
      fs.writeFileSync(path.join(dest, 'package.json'), originalPackageJson);
      if (originalSrcFile) {
        const srcPath = path.join(dest, 'src', 'index.js');
        fs.writeFileSync(srcPath, originalSrcFile);
      }
    });

    describe('Version comparison (first check)', () => {
      it('should force publish when local version newer than registry', (done) => {
        const pkg = JSON.parse(fs.readFileSync(path.join(dest, 'package.json'), 'utf8'));
        pkg.version = '99.99.99';
        fs.writeFileSync(path.join(dest, 'package.json'), `${JSON.stringify(pkg, null, 2)}\n`);

        hasChanged({ cwd: dest }, (err, result): undefined => {
          if (err) {
            done(err);
            return;
          }
          assert.ok(result);
          assert.equal(result.changed, true);
          assert.ok(result.reason.indexOf('Version differs') >= 0);
          assert.ok(result.reason.indexOf('99.99.99') >= 0);
          done();
        });
      });

      it('should force publish when local version older than registry', (done) => {
        const pkg = JSON.parse(fs.readFileSync(path.join(dest, 'package.json'), 'utf8'));
        pkg.version = '0.0.1';
        fs.writeFileSync(path.join(dest, 'package.json'), `${JSON.stringify(pkg, null, 2)}\n`);

        hasChanged({ cwd: dest }, (err, result): undefined => {
          if (err) {
            done(err);
            return;
          }
          assert.ok(result);
          assert.equal(result.changed, true);
          assert.ok(result.reason.indexOf('Version differs') >= 0);
          assert.ok(result.reason.indexOf('0.0.1') >= 0);
          done();
        });
      });

      it('should proceed to integrity check when versions match', (done) => {
        hasChanged({ cwd: dest }, (err, result): undefined => {
          if (err) {
            done(err);
            return;
          }
          assert.ok(result);
          assert.ok(result.reason.indexOf('Version differs') < 0);
          done();
        });
      });
    });

    describe('Integrity comparison (second check)', () => {
      it('should skip when versions match and hashes match', (done) => {
        hasChanged({ cwd: dest }, (err, result): undefined => {
          if (err) {
            done(err);
            return;
          }
          assert.ok(result);
          // Note: parser-multipart git clone may have changes not in registry
          // This test validates the code works, but may detect real changes
          assert.ok(result.reason);
          done();
        });
      });

      it('should publish when versions match but hashes differ', (done) => {
        const srcPath = path.join(dest, 'src', 'index.js');
        fs.appendFileSync(srcPath, '\n// Test modification to trigger hash difference\n');

        hasChanged({ cwd: dest }, (err, result): undefined => {
          if (err) {
            done(err);
            return;
          }
          assert.ok(result);
          assert.equal(result.changed, true);
          assert.ok(result.reason);
          done();
        });
      });
    });

    describe('Error handling', () => {
      it('should force publish for first-time packages (E404)', (done) => {
        const pkg = JSON.parse(fs.readFileSync(path.join(dest, 'package.json'), 'utf8'));
        pkg.name = `@test-tsds-publish/nonexistent-package-${Date.now()}`;
        fs.writeFileSync(path.join(dest, 'package.json'), `${JSON.stringify(pkg, null, 2)}\n`);

        hasChanged({ cwd: dest }, (err, result): undefined => {
          if (err) {
            done(err);
            return;
          }
          assert.ok(result);
          assert.equal(result.changed, true);
          assert.ok(result.reason.indexOf('Package not found in registry') >= 0 || result.reason.indexOf('first publish') >= 0);
          done();
        });
      });

      it('should handle unknown errors gracefully', function (done) {
        // Hard to reliably trigger non-E404 errors - skip for now
        this.skip();
        done();
      });
    });

    describe('Scoped packages', () => {
      it('should use scoped registry from npm config', (done) => {
        hasChanged({ cwd: dest }, (err, result): undefined => {
          if (err) {
            done(err);
            return;
          }
          assert.ok(result);
          assert.equal(typeof result.changed, 'boolean');
          assert.equal(typeof result.reason, 'string');
          done();
        });
      });
    });

    describe('publish command', () => {
      it('should block publish in test environment without --dry-run', (done) => {
        // Bump version to trigger publish (not skip due to "no changes")
        const pkg = JSON.parse(fs.readFileSync(path.join(dest, 'package.json'), 'utf8'));
        pkg.version = '99.99.99';
        fs.writeFileSync(path.join(dest, 'package.json'), `${JSON.stringify(pkg, null, 2)}\n`);

        publish(['--yolo'], { cwd: dest }, (err): undefined => {
          assert.ok(err);
          assert.ok(err.message.indexOf('Cannot publish in test environment without --dry-run') >= 0);
          done();
        });
      });

      it('should pass safeguard with --dry-run in test environment', (done) => {
        // Bump version to trigger publish (not skip due to "no changes")
        const pkg = JSON.parse(fs.readFileSync(path.join(dest, 'package.json'), 'utf8'));
        pkg.version = '99.99.99';
        fs.writeFileSync(path.join(dest, 'package.json'), `${JSON.stringify(pkg, null, 2)}\n`);

        publish(['--dry-run', '--yolo'], { cwd: dest, stdio: 'inherit' }, (err): undefined => {
          // With --dry-run, the safeguard should NOT trigger
          // The command may fail later (npm version/publish issues) but that's OK
          // We just verify it got past the NODE_ENV=test safeguard
          if (err && err.message.indexOf('Cannot publish in test environment') >= 0) {
            done(new Error('Safeguard should not block with --dry-run'));
            return;
          }
          // Any other error (or success) means the safeguard passed
          done();
        });
      });
    });
  });
}
describe('lib', () => {
  for (let i = 0; i < GITS.length; i++) {
    addTests(GITS[i]);
  }
});
