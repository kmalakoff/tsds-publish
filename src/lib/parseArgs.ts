import getopts from 'getopts-compat';
import type { ParsedArgs } from '../types.ts';

export default function parseArgs(args: string[]): ParsedArgs {
  const opts = getopts(args, { alias: { otp: 'o', 'dry-run': 'd' }, boolean: ['yolo', 'dry-run'] });

  const publishArgs = ['publish'];
  if (opts['dry-run']) publishArgs.push('--dry-run');
  if (opts.otp) publishArgs.push(`--otp=${opts.otp}`);
  if (opts.tag) publishArgs.push(`--tag=${opts.tag}`);

  return {
    version: opts._.length > 0 ? `${opts._[0]}` : 'patch',
    yolo: !!opts.yolo,
    dryRun: !!opts['dry-run'],
    publishArgs,
  };
}
