import path from "path";
import { TsConfigOptions } from "ts-node";
import ts  from "typescript";
import { Configuration } from "webpack";
import nodeExternals from 'webpack-node-externals';

export const tsCompilerOptions: ts.CompilerOptions = {
  module: ts.ModuleKind.CommonJS,
  target: ts.ScriptTarget.ES2018,
}

export const tsNodeCompilerOptions: TsConfigOptions = {
  transpileOnly: true,
  compilerOptions: {
    module: 'CommonJS',
    target: 'ES5'
  }
}

export const getWebpackConfig = (entry: string): Configuration => ({
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
  /*
  externals: (data, callback) => {
    const request = data.request;
    if (!request) { callback(); return; }

    if (/node_modules/.test(request)) {
      return callback(null, 'commonjs ' + request); // Externalize node_modules
    }
    callback();
  },
  */
  cache: false
});