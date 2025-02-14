import nodeExternals from 'webpack-node-externals';
import path from 'path';
import { Configuration } from "webpack";
import fs from 'fs';
import { webpack } from 'webpack';

const BUILD_PATH = path.resolve(process.cwd(), '.out');
const BUILD_FILENAME = 'bundle.js';
const BUILD_FILE_PATH = path.resolve( BUILD_PATH, BUILD_FILENAME);

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

export function buildWorkerCode(entryFile: string) {
  return new Promise<string>((resolve, reject) => {
    const compiler = webpack(getWebpackConfig(entryFile));

    compiler.run((err, stats) => {
      if (err) {
        reject(err);
        return;
      }

      /*
      console.log(stats?.toString({
        chunks: false,
        colors: true
      }));
      */

      const bundledCode = fs
        .readFileSync(BUILD_FILE_PATH, 'utf8');

      resolve(bundledCode);
    });
  });
}

const getWebpackConfig = (entry: string): Configuration => ({
  entry,
  output: {
    filename: BUILD_FILENAME,
    path: BUILD_PATH,
    libraryTarget: 'commonjs2',
    module: false,
    iife: false,
    umdNamedDefine: true,
  },
  resolve: {
    extensions: ['.ts', '.js'], 
    fallback: {
      path: false,
      worker_threads: false,
      fs: false,
    }
  },
  mode: 'development',
  target: 'node',
  module: {
    rules: [
      {
        test: /\.ts$/, 
        use:  [
          {
            loader: 'babel-loader',
            options: {
              presets: ['@babel/preset-env', '@babel/preset-typescript'],
              plugins: ['@babel/plugin-transform-modules-commonjs']
            },
          }
        ],
        exclude: /node_modules/
      }
    ],
  },
  devtool: 'source-map',
  stats: 'verbose',
  externals: [nodeExternals({
    importType: 'commonjs',
  })],
  cache: false
});