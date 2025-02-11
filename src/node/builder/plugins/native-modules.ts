import { Plugin } from "esbuild";

export const nativeModulesPlugin: Plugin = {
  name: 'native-module',
  setup(build) {
    build.onLoad({ filter: /\.node$/ }, async(args): Promise<any> => {
      console.log('node binary: ', args.path);
      return { path: args.path, namespace: 'native', external: true };
    });
  },
}