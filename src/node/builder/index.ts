import Comlink from 'comlink';
import { Worker as ThreadWorker } from 'worker_threads';
import nodeEndpoint from 'comlink/dist/umd/node-adapter.js';
import { buildWorkerCode } from './helpers';
import path from 'path';
import { getCallerDir } from '../../helpers/builder';

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
): { worker: ThreadWorker, api: Comlink.RemoteObject<T> } => {

  const worker = new ThreadWorker(code, { eval: true });
  const api = Comlink.wrap<T>(nodeEndpoint(worker));

  return { worker, api };
}