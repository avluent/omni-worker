import * as Comlink from 'comlink/dist/esm/comlink';

export const buildWebApiAndWorker = <T>(
  url: URL
): { worker: Worker, api: Comlink.RemoteObject<T> } => {
  
  const worker = new Worker(url, { type: 'module' });
  const api = Comlink.wrap<T>(worker);

  return { worker, api };
}