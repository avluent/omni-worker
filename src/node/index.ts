import { IBuildable, IExposable, IOmniWorker } from '../types/index.d';
import { parentPort, Worker as ThreadWorker } from 'worker_threads';
import Comlink from 'comlink';
import nodeEndpoint from 'comlink/dist/umd/node-adapter';
import { buildNodeApiAndWorkerFromCode, genWorkerCodeFromFile } from './builder';
import { IPoolable } from '../types/pool.d';
import { staticImplements } from '../types/helpers';

@staticImplements<IBuildable>()
@staticImplements<IExposable>()
export class NodeOmniWorker<T> implements IOmniWorker<T>, IPoolable<T> {

  private _code: string;
  private _worker: ThreadWorker;
  private _api: Comlink.RemoteObject<T>;

  private constructor(
    code: string,
    worker: ThreadWorker,
    api: Comlink.RemoteObject<T>
  ) {
    this._code = code;
    this._worker = worker;
    this._api = api;
    return this;
  }

  public static expose = <T>(functions: T) => {
    if (parentPort) {
      Comlink.expose(functions, nodeEndpoint(parentPort));
    }
  }

  public static async build<T>(
    path: string
  ): Promise<NodeOmniWorker<T>> {
    const code = await genWorkerCodeFromFile(path);
    const { worker, api } = buildNodeApiAndWorkerFromCode<T>(code);
    return new NodeOmniWorker<T>(code, worker, api);
  }

  public isInitialized = (): boolean => (
    this._api !== undefined
  );

  public use = () => {
    const isInitialized = this.isInitialized();
    if (isInitialized) {
      return this._api!;
    } else {
      throw Error('worker is not yet initialized. make sure to call the .set() function, first');
    }
  }

  public clone = (numOfTimes: number) => {
    const workers: NodeOmniWorker<T>[] = [];
    for (let i = 0; i <= numOfTimes; i++) {
      const code = this._code;
      const { worker, api } = buildNodeApiAndWorkerFromCode<T>(code);
      workers.push(new NodeOmniWorker<T>(code, worker, api));
    }
    return workers;
  }

  public destroy = async () => {
    await this._worker.terminate();
  }
}