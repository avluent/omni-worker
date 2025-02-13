import nodeExternals from 'webpack-node-externals';
import path from 'path';
import { Configuration } from "webpack";
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

export function buildWorkerCode(entryFile: string) {
  const mfs = new MemoryFS();

  return new Promise<string>((resolve, reject) => {
    const compiler = webpack(getWebpackConfig(entryFile));
    compiler.outputFileSystem = mfs as unknown as OutputFileSystem;

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

      const bundledCode = mfs
        .readFileSync(path.join('/virtual', 'bundle.js'), 'utf8');

      resolve(bundledCode);
    });
  });
}

const getWebpackConfig = (entry: string): Configuration => ({
  entry,
  output: {
    filename: 'bundle.js',
    path: path.resolve('/virtual'),
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