import path from 'path';
import fs from 'fs';
import ts from 'typescript';
import { getWebpackConfig, tsCompilerOptions, tsNodeCompilerOptions } from './constants';
import MemoryFS from 'memory-fs';
import { OutputFileSystem, webpack } from 'webpack';

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

const mfs = new MemoryFS();

export function buildWorkerCode(entryFile: string) {
  const compiler = webpack(getWebpackConfig(entryFile));
  compiler.outputFileSystem = mfs as unknown as OutputFileSystem;

  return new Promise<string>((resolve, reject) => {
    compiler.run((err, stats) => {
      if (err) {
        reject(err);
        return;
      }

      console.log(stats?.toString({
        chunks: false,
        colors: true
      }));

      const bundledCode = mfs
        .readFileSync(path.join('/virtual', 'bundle.js'), 'utf8');

      resolve(bundledCode);
    });
  });
}


// Create a compiler instance with the Webpack configuration