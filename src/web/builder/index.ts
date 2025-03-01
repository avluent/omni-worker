import * as Comlink from 'comlink/dist/esm/comlink';
import { convertToJsUrl } from './helpers';
import { WebOmniWorkerBuilderOptions } from './model';

export const buildWebApiAndWorker = <T>(
  tsUrl: URL,
  options: WebOmniWorkerBuilderOptions
): { jsUrl: URL, worker: Worker, api: Comlink.RemoteObject<T> } => {

  const extension = options.extension || '.js';
  const jsUrl = convertToJsUrl(tsUrl, extension);

  const worker = new Worker(jsUrl, { type: 'module' });
  const api = Comlink.wrap<T>(worker);

  return { jsUrl, worker, api };
}