import Comlink from 'comlink';
import { Worker } from 'worker_threads';
import nodeEndpoint from 'comlink/dist/umd/node-adapter.js';
import { buildWorkerCode, getCallerDir } from './helpers';
import path from 'path';

export const genWorkerCodeFromFile = async (
  workerPath: string
): Promise<string> => {
  const callerDir = getCallerDir();
  const resolvedPath = path.resolve(callerDir, workerPath);
  const code = await buildWorkerCode(resolvedPath);
  return code;
}

export const buildNodeApiAndWorkerFromCode = <T>(
  code: string
): { worker: Worker, api: Comlink.RemoteObject<T> } => {

  const worker = new Worker(code, { eval: true });
  const api = Comlink.wrap<T>(nodeEndpoint(worker));

  return { worker, api };
}