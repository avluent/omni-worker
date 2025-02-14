import * as Comlink from 'comlink';
import { Worker } from 'worker_threads';
import nodeEndpoint from 'comlink/dist/umd/node-adapter.js';
import { buildWorkerCode, getCallerDir } from './helpers';
import path from 'path';

export const buildApiNode = async <T>(
  workerPath: string
): Promise<{ api: Comlink.Remote<T>, worker: Worker}> => {

  const callerDir = getCallerDir();
  const resolvedPath = path.resolve(callerDir, workerPath);

  const js = await buildWorkerCode(resolvedPath);

  const worker = new Worker(js, { eval: true });
  const api = Comlink.wrap<T>(nodeEndpoint(worker));

  return { api, worker };
}