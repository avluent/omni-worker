import { Plugin } from "esbuild";

export const nativeModulesPlugin: Plugin = {
  name: 'native-module',
  setup(build) {
    build.onResolve({ filter: /\.node$/ }, args => {
      return { path: args.path, namespace: 'native', external: true };
    });
  },
}