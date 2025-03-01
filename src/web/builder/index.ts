import * as Comlink from 'comlink/dist/esm/comlink';
import { convertToJsUrl } from './helpers';
import { IWebOmniWorkerBuilderOptions } from '../../types/web-omni-worker';

export const buildWebApiAndWorker = <T>(
  tsUrl: URL,
  options: IWebOmniWorkerBuilderOptions
): { jsUrl: URL, worker: Worker, api: Comlink.RemoteObject<T> } => {

  const extension = options.extension || '.js';
  const jsUrl = convertToJsUrl(tsUrl, extension);

  const worker = new Worker(jsUrl, { type: 'module' });
  const api = Comlink.wrap<T>(worker);

  return { jsUrl, worker, api };
}