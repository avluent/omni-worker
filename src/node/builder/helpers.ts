import nodeExternals from 'webpack-node-externals';
import path from 'path';
import { Configuration } from "webpack";
import fs from 'fs';
import { webpack } from 'webpack';
import TerserPlugin from 'terser-webpack-plugin';

const BUILD_PATH = path.join(__dirname, '.out');
const BUILD_FILENAME = 'bundle.js';
const BUILD_FILE_PATH = path.join(BUILD_PATH, BUILD_FILENAME);

export function buildWorkerCode(entryFile: string) {
  return new Promise<string>((resolve, reject) => {

    if (!fs.existsSync(BUILD_PATH)) {
      fs.mkdirSync(BUILD_PATH, { recursive: true });
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

      // clean up the build folder
      fs.rm(BUILD_PATH, { recursive: true, force: true }, (err) => {
        if (err) {
          reject(err);
        }
      });
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
      assert: false,
      buffer: false,
      console: false,
      constants: false,
      crypto: false,
      domain: false,
      events: false,
      fs: false,
      http: false,
      https: false,
      module: false,
      net: false,
      os: false,
      path: false,
      process: false,
      punycode: false,
      querystring: false,
      readline: false,
      stream: false,
      string_decoder: false,
      sys: false,
      timers: false,
      tls: false,
      tty: false,
      url: false,
      util: false,
      vm: false,
      worker_threads: false,
      zlib: false,
    },
  },
  resolveLoader: {
    modules: [
      path.resolve(process.cwd(), 'node_modules')
    ]
  },
  mode: 'production',
  optimization: {
    minimize: true,
    minimizer: [
      new TerserPlugin({
        terserOptions: {
          compress: {
            drop_console: true,
            drop_debugger: true
          },
        }
      })
    ]
  },
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