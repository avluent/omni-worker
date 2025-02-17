import path from 'path';
import { getCallerDir } from "../../helpers/builder"
import { buildWorkerCode } from './helpers';
import Comlink from 'comlink';

export const genWorkerCodeFromFile = async (
  workerPath: string
): Promise<string> => {
  const callerDir = getCallerDir();
  const resolvedPath = path.resolve(callerDir, workerPath);
  const code = await buildWorkerCode(resolvedPath);
  return code;
}

export const buildWebApiAndWorkerFromCode = <T>(
  code: string
): { worker: Worker, api: Comlink.RemoteObject<T> } => {
  
  const worker = new Worker(code, { type: 'module' });
  const api = Comlink.wrap<T>(worker);

  return { worker, api };
}