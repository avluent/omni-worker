import { Plugin } from 'esbuild';

const nativeModulePlugin: Plugin = {
  name: 'native-module',
  setup(build) {
    build.onResolve({ filter: /\.node$/ }, args => {
      return { path: args.path, namespace: 'native', external: true };
    });
    build.onLoad({ filter: /\.node$/, namespace: 'native' }, async args => {
      const fs = require('fs');
      const path = require('path');
      const binary = fs.readFileSync(path.resolve(args.pluginData.resolveDir, args.path));
      return { contents: binary, loader: 'binary' };
    });
  },
}