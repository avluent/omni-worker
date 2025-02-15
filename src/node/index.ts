import { IOmniWorker } from '../types/index.d';
import { parentPort, Worker } from 'worker_threads';
import Comlink from 'comlink';
import nodeEndpoint from 'comlink/dist/umd/node-adapter';
import { buildNodeApiAndWorkerFromCode, genWorkerCodeFromFile } from './builder';
import { IPoolable, IPoolOptions } from '../types/pool.d';
import { NodeOmniWorkerPool } from './pool';

export class NodeOmniWorker<T> implements IOmniWorker<T>, IPoolable<T> {
  private _api: Comlink.RemoteObject<T>;
  private _worker: Worker;
  private _code: string;

  private constructor(
    code: string,
    worker: Worker,
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
   * @param functions An object with functions inside the worker to be exposed to
   * the rest of the application.
   */
  public static expose = <T extends object>(functions: T) => {
    if (parentPort) {
      Comlink.expose(functions, nodeEndpoint(parentPort));
    }
  }

  /**
   * Build the OmniWorker from a worker file. Please note that the functions
   * on the worker file need to first be exposed using the expose({ <functions> })
   * functions, in order to start this build step.
   * 
   * @param path The relative path to where the worker module is located
   * @returns A new Node OmniWorker
   */
  public static async build<T extends object>(
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

  public toPool = <T extends object>(options?: IPoolOptions): NodeOmniWorkerPool<T> => 
    NodeOmniWorkerPool.launch<T>(this as unknown as NodeOmniWorker<T>, options);

  public destroy = async () => {
    await this._worker.terminate();
  }
}