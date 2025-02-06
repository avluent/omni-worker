import * as Comlink from 'comlink';
import * as esbuild from 'esbuild';
import externalImportsPlugin from './plugins/external-imports';
import { Worker } from 'worker_threads';
import nodeEndpoint from 'comlink/dist/umd/node-adapter.js';

export const buildApiNode = async <T>(path: string): Promise<Comlink.Remote<T>> => {
  const result = await esbuild.build({
    entryPoints: [path],
    loader: { ".ts": "ts" },
    format: "cjs",
    bundle: true,
    minify: true,
    write: false,
    plugins: [externalImportsPlugin]
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