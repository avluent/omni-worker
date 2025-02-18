import { IBuildable, IExposable, IOmniWorker } from '../types/omni-worker';
import { parentPort, Worker as ThreadWorker } from 'worker_threads';
import Comlink from 'comlink';
import nodeEndpoint from 'comlink/dist/umd/node-adapter';
import { buildNodeApiAndWorkerFromCode, genWorkerCodeFromFile } from './builder';
import { IPoolable } from '../types/pool';
import { staticImplements } from '../types/helpers';

/**
 * OmniWorker for NodeJS
 */
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

  /**
   * Expose the functions inside the worker to the rest of the application.
   * After having exposed the functions, the build step can be initiated.
   * @param exposable A class, object with functions or a single function to be
   * exposed to the main thread.
   */
  public static expose = <T>(exposable: T) => {
    if (parentPort) {
      Comlink.expose(exposable, nodeEndpoint(parentPort));
    }
  }

  /**
   * Handles the building of the necessary resources for an OmniWorker to function.
   * This usually means, building from the consumer's code, creating the comlink
   * interface between the worker and the main thread as well as the worker itself.
   * 
   * @param path Relative path FROM YOUR PROJECT's ROOT to the file to be the worker
   * @returns An OmniWorker
   */
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
      throw Error('worker is not yet initialized. make sure to call the build() function, first');
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