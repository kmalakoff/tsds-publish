import spawn from 'cross-spawn-cb';
import fs from 'fs';
import { safeRm } from 'fs-remove-compat';
import getopts from 'getopts-compat';
import { wrap } from 'node-version-call';
import path from 'path';
import Queue from 'queue-cb';
import type { CommandCallback, CommandOptions } from 'tsds-lib';
import url from 'url';
import hasChanged from './lib/hasChanged.ts';

const major = +process.versions.node.split('.')[0];
const version = major >= 18 ? 'local' : 'stable';
const __dirname = path.dirname(typeof __filename === 'undefined' ? url.fileURLToPath(import.meta.url) : __filename);
const dist = path.join(__dirname, '..');
const workerWrapper = wrap(path.join(dist, 'cjs', 'command.js'));

function worker(args: string[], options_: CommandOptions, callback: CommandCallback): undefined {
  const cwd = options_.cwd || process.cwd();
  const options = { ...options_ } as CommandOptions;
  options.package = options.package || JSON.parse(fs.readFileSync(path.join(cwd as string, 'package.json'), 'utf8'));
  if (options.package.private) {
    console.log(`Skipping ${options.package.name}. Private`);
    return callback();
  }

  const opts = getopts(args, { alias: { otp: 'o', 'dry-run': 'd' }, boolean: ['yolo', 'dry-run'] });
  hasChanged(options, (err, result): undefined => {
    if (err) {
      callback(err);
      return;
    }
    if (!result.changed) {
      console.log(`Skipping ${options.package.name}. ${result.reason}`);
      callback();
      return;
    }

    console.log(`Publishing ${options.package.name}. ${result.reason}`);

    const queue = new Queue(1);

    // run tests
    if (!opts.yolo) {
      queue.defer((cb) => safeRm(path.join(cwd as string, 'node_modules'), cb));
      queue.defer(spawn.bind(null, 'npm', ['ci'], { ...options, cwd }));
      queue.defer(spawn.bind(null, 'npm', ['test'], { ...options, cwd }));
    }

    // update the version
    const versionArgs = ['version', opts._.length > 0 ? opts._[0] : 'patch'];
    queue.defer((cb) =>
      spawn('npm', versionArgs, options, (err) => {
        if (err) return cb(err);
        options.package = JSON.parse(fs.readFileSync(path.join(cwd as string, 'package.json'), 'utf8'));
        cb();
      })
    );

    // do publish
    // Safeguard: block actual publish in test environment without --dry-run
    if (process.env.NODE_ENV === 'test' && !opts['dry-run']) {
      return callback(new Error('Cannot publish in test environment without --dry-run'));
    }
    const publishArgs = ['publish'];
    if (opts['dry-run']) publishArgs.push('--dry-run');
    if (opts.otp) publishArgs.push(`--otp=${opts.otp}`);
    queue.defer(spawn.bind(null, 'npm', publishArgs, options));

    // do post actions
    // Note: npm version already runs the "version" script automatically, so no need to run it again
    queue.defer((cb) => spawn('git', ['add', '.'], options, cb.bind(null, null)));
    queue.defer((cb) => spawn('git', ['commit', '-m', `${options.package.version}`], options, cb.bind(null, null)));
    queue.await(callback);
  });
}

export default function publish(args: string[], options: CommandOptions, callback: CommandCallback): undefined {
  version !== 'local' ? workerWrapper(version, args, options, callback) : worker(args, options, callback);
}
