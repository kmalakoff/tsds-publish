import Module from 'module';
import { bind } from 'node-version-call';
import path from 'path';
import type { CommandOptions } from 'tsds-lib';
import url from 'url';

const major = +process.versions.node.split('.')[0];
const _require = typeof require === 'undefined' ? Module.createRequire(import.meta.url) : require;
const __dirname = path.dirname(typeof __filename === 'undefined' ? url.fileURLToPath(import.meta.url) : __filename);
const dist = path.join(__dirname, '..', '..');

import type { HasChangedCallback } from '../types.ts';

function run(options: CommandOptions, callback: HasChangedCallback) {
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

const worker = major >= 20 ? run : bind('>=20', path.join(dist, 'cjs', 'lib', 'hasChanged.js'), { callbacks: true });

export default function hasChanged(options: CommandOptions, callback: HasChangedCallback): void {
  worker(options, callback);
}
