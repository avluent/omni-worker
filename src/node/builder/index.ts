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

export const buildApiNode = async <T>(
  path: string,
  options: INodeOmniWorkerBuildOptions
): Promise<Comlink.Remote<T>> => {

  const callerDir = getCallerDir();
  const fullFilePath = _path.resolve(callerDir, path);

  const result = await esbuild.build({
    entryPoints: [fullFilePath],
    loader: {
      ".ts": "ts",
      ".js": "js",
    },
    format: "cjs",
    bundle: true,
    minify: false,
    write: false,
    plugins: [
      externalImportsPlugin(callerDir),             // externalize all dependencies
      nodeExternalsPlugin(),                        // externalize nodejs modules
      nativeModulesPlugin                           // handle .node files
    ]
  });

  const outputFiles = result.outputFiles;

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

  return api;
}