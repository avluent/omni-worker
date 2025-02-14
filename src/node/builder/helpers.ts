import nodeExternals from 'webpack-node-externals';
import path from 'path';
import { Configuration } from "webpack";
import fs from 'fs';
import { webpack } from 'webpack';

const BUILD_PATH = path.join(__dirname, '.out');
const BUILD_FILENAME = 'bundle.js';
const BUILD_FILE_PATH = path.join( BUILD_PATH, BUILD_FILENAME);

export function getCallerDir() {
  try {
    const stack = new Error().stack!;
    const line = stack.split('\n')[1].trim();
    const segment = line.split(' ')[1];
    const part = segment.split(':')[0];
    const dirName = path.dirname(part);

    return dirName;
  } catch (e) {
    // console.error('building caller path failed', e);
    return './';
  }
}

export function buildWorkerCode(entryFile: string) {
  return new Promise<string>((resolve, reject) => {

    if (!fs.existsSync(BUILD_PATH)) {
      fs.mkdirSync(BUILD_PATH, { recursive: true });
      // console.log(`created '${BUILD_PATH}' successfully!`);
    }

    const config = getWebpackConfig(entryFile);
    const compiler = webpack(config);

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

const resolveNodeModules = (packageName: string) => 
  require.resolve(packageName,
    {
      paths: [
        path.resolve(__dirname, 'node_modules')
      ]
    });

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
  resolveLoader: {
    modules: [
      path.resolve(process.cwd(), 'node_modules')
    ]
  },
  mode: 'development',
  target: 'node',
  module: {
    rules: [
      {
        test: /\.ts$/, 
        use:  [
          {
            loader: resolveNodeModules('babel-loader'),
            options: {
              presets: [
                resolveNodeModules('@babel/preset-env'),
                resolveNodeModules('@babel/preset-typescript')
              ],
              plugins: [
                resolveNodeModules('@babel/plugin-transform-modules-commonjs')
              ]
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