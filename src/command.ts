import spawn from 'cross-spawn-cb';
import fs from 'fs';
import { safeRm } from 'fs-remove-compat';
import getopts from 'getopts-compat';
import { bind } from 'node-version-call';
import path from 'path';
import Queue from 'queue-cb';
import type { CommandCallback, CommandOptions } from 'tsds-lib';
import url from 'url';
import hasChanged from './lib/hasChanged.ts';

const major = +process.versions.node.split('.')[0];
const __dirname = path.dirname(typeof __filename === 'undefined' ? url.fileURLToPath(import.meta.url) : __filename);
const dist = path.join(__dirname, '..');

function run(args: string[], options_: CommandOptions, callback: CommandCallback) {
  const cwd = options_.cwd || process.cwd();
  const options = { ...options_ } as CommandOptions;
  options.package = options.package || JSON.parse(fs.readFileSync(path.join(cwd as string, 'package.json'), 'utf8'));
  if (options.package.private) {
    console.log(`Skipping ${options.package.name}. Private`);
    return callback();
  }

  const opts = getopts(args, { alias: { otp: 'o', 'dry-run': 'd' }, boolean: ['yolo', 'dry-run'] });
  hasChanged(options, (err, result): void => {
    if (err) return callback(err);
    if (!result.changed) {
      console.log(`Skipping ${options.package.name}. ${result.reason}`);
      callback();
      return;
    }

    console.log(`Publishing ${options.package.name}. ${result.reason}`);

    const queue = new Queue(1);

    // run tests
    if (!opts.yolo) {
      queue.defer(safeRm.bind(null, path.join(cwd as string, 'node_modules')));
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
    queue.defer((cb) => spawn('git', ['add', '.'], options, cb.bind(null, null)));
    queue.defer((cb) => spawn('git', ['commit', '-m', `${options.package.version}`], options, cb.bind(null, null)));
    queue.await(callback);
  });
}

type commandFunction = (args: string[], options: CommandOptions, callback: CommandCallback) => void;

const worker = (major >= 20 ? run : bind('>=20', path.join(dist, 'cjs', 'command.js'), { callbacks: true })) as commandFunction;

export default function publish(args: string[], options: CommandOptions, callback: CommandCallback): void {
  worker(args, options, callback);
}
