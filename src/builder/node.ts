import * as Comlink from 'comlink';
import { Worker } from 'worker_threads';
import nodeEndpoint from 'comlink/dist/umd/node-adapter.js';
import * as _path from 'path';
import { buildWorkerCode, getCallerDir } from './helpers';

export const buildApiNode = async <T>(path: string): Promise<Comlink.Remote<T>> => {

  const callerDir = getCallerDir();
  const resolvedPath = _path.resolve(callerDir, path);

  const js = await buildWorkerCode(resolvedPath);

  const worker = new Worker(js, { eval: true });
  const api = Comlink.wrap<T>(nodeEndpoint(worker));

  return api;
}