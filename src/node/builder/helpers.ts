import path from 'path';

export function getCallerDir() {
  try {
    const stack = new Error().stack!;
    const line = stack.split('\n')[1].trim();
    const segment = line.split(' ')[1];
    const part = segment.split(':')[0];
    const dirName = path.dirname(part);

    return dirName;
  } catch (e) {
    console.error('building caller path failed', e);
    return './';
  }
}

const nodeCoreModules = [
  'assert',
  'async_hooks',
  'buffer',
  'child_process',
  'cluster',
  'console',
  'constants',
  'crypto',
  'dgram',
  'diagnostics_channel',
  'dns',
  'domain',
  'events',
  'fs',
  'http',
  'http2',
  'https',
  'inspector',
  'module',
  'net',
  'os',
  'path',
  'perf_hooks',
  'process',
  'punycode',
  'querystring',
  'readline',
  'repl',
  'stream',
  'string_decoder',
  'sys',
  'timers',
  'tls',
  'trace_events',
  'tty',
  'url',
  'util',
  'v8',
  'vm',
  'wasi',
  'worker_threads',
  'zlib',
];
export const isNodeCoreModule = (name: string) => {
  return nodeCoreModules.includes(name);
}