import { Plugin } from "esbuild";

export const nativeModulesPlugin: Plugin = {
  name: 'native-module',
  setup(build) {
    build.onResolve({ filter: /\.node$/ }, args => {
      console.log('node binary: ', args.path);
      return { path: args.path, namespace: 'native', external: true };
    });
  },
}