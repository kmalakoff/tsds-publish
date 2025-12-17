import Module from 'module';
import { wrap } from 'node-version-call';
import path from 'path';
import type { CommandOptions } from 'tsds-lib';
import url from 'url';

const major = +process.versions.node.split('.')[0];
const version = major >= 18 ? 'local' : 'stable';
const _require = typeof require === 'undefined' ? Module.createRequire(import.meta.url) : require;
const __dirname = path.dirname(typeof __filename === 'undefined' ? url.fileURLToPath(import.meta.url) : __filename);
const dist = path.join(__dirname, '..', '..');
const workerWrapper = wrap(path.join(dist, 'cjs', 'lib', 'hasChanged.js'));

import type { HasChangedCallback } from '../types.ts';

function worker(options: CommandOptions, callback: HasChangedCallback): undefined {
  const cwd: string = (options.cwd as string) || process.cwd();
  const { needsPublish } = _require('npm-needs-publish');

  needsPublish({ cwd })
    .then((result) => {
      callback(null, {
        changed: result.needsPublish,
        reason: result.reason,
      });
    })
    .catch(callback);
}

export default function hasChanged(options: CommandOptions, callback: HasChangedCallback): undefined {
  version !== 'local' ? workerWrapper(version, options, callback) : worker(options, callback);
}
