import * as Comlink from 'comlink';
import * as esbuild from 'esbuild';
import externalImportsPlugin from './plugins/external-imports';
import { Worker } from 'worker_threads';
import nodeEndpoint from 'comlink/dist/umd/node-adapter.js';
import * as _path from 'path';
import { getCallerDir } from './helpers';
import { INodeOmniWorkerBuildOptions } from '../../types';
import { nodeExternalsPlugin } from 'esbuild-node-externals'
import { nativeModulesPlugin } from './plugins/native-modules';
import swisseph from 'swisseph';
import { modulesExportFixPlugin } from './plugins/fix-modules-export';

export const buildApiNode = async <T>(
  path: string,
  options: INodeOmniWorkerBuildOptions
): Promise<Comlink.Remote<T>> => {

  const callerDir = getCallerDir();
  const fullFilePath = _path.resolve(callerDir, path);

  await esbuild.build({
    entryPoints: ['./node_modules/swisseph/lib/swisseph.js'],
    loader: {
      ".ts": "ts",
      ".js": "js",
      ".node": "file"
    },
    format: "cjs",
    platform: 'node',
    bundle: true,
    minify: false,
    write: true,
    define: { "__dirname": `"${_path.resolve(callerDir, './node_modules/swisseph/lib')}"` },
    outfile: 'build/swisseph.js',
    external: ['swisseph'],
    plugins: [
      nodeExternalsPlugin(),
      modulesExportFixPlugin()
    ]
  })

  /*
  await esbuild.build({
    stdin: {
      contents: `
        const path = require("path");

        // Redirect the import to a custom file
        require.cache[require.resolve("swisseph")] = {
          exports: require(path.resolve(__dirname, "./swisseph.js")),
        };
      `
    },
    loader: {
      ".ts": "ts",
      ".js": "js",
      ".node": "file"
    },
    format: "cjs",
    platform: 'node',
    define: { "__dirname": `"${_path.resolve(callerDir, './build')}"` },
    bundle: true,
    minify: false,
    write: true,
    outfile: 'build/glue.js',
    external: ['path', 'swisseph'],
    plugins: [
      nodeExternalsPlugin()
    ]
  })
    */

  const result = await esbuild.build({
    entryPoints: [fullFilePath],
    loader: {
      ".ts": "ts",
      ".js": "js",
      ".node": "file"
    },
    format: "cjs",
    platform: 'node',
    banner: {

    "js": `
        const ___path = require("path");

        // Redirect the import to a custom file
        require.cache[require.resolve("swisseph")] = {
          exports: require(___path.resolve(__dirname, "./swisseph.js")),
        };
    `
    },
    bundle: true,
    define: { 
      "__dirname": `"${_path.resolve(callerDir, './build')}"`,
      // require: "require", // Force require to remain unchanged
    },
    minify: false,
    write: true,
    // outdir: 'build',
    outfile: 'build/index.js',
    inject: [],
    // external: ["swisseph", "./swisseph-RZR6JWWN.node"],
    plugins: [
      externalImportsPlugin(callerDir),             // externalize all dependencies
      nodeExternalsPlugin(),                        // externalize nodejs modules
      nativeModulesPlugin                           // handle .node files
    ]
  });

  const outputFiles = result.outputFiles;

  /*
  if (
    !outputFiles ||
    result.outputFiles.length < 1 ||
    result.outputFiles[0].text === undefined ||
    result.outputFiles[0].text === ""
  ) {
    throw Error("no build output for worker");
  }

  const scriptData = result.outputFiles[0].text.trim();
  const worker = new Worker(scriptData, { eval: true });
  const api = Comlink.wrap<T>(nodeEndpoint(worker));
  */
  const worker = new Worker('./build/index', { workerData: { greeting: "hello" } });
  const api = Comlink.wrap<T>(nodeEndpoint(worker));
  return api;
}