import { IOmniWorker } from '../types/index.d';
import { parentPort, Worker } from 'worker_threads';
import Comlink from 'comlink';
import nodeEndpoint from 'comlink/dist/umd/node-adapter';
import { buildNodeApiAndWorkerFromCode, genWorkerCodeFromFile } from './builder';
import { IPoolable, IPoolOptions } from '../types/pool.d';

export class NodeOmniWorker<T> implements IOmniWorker<T>, IPoolable<T> {
  private _path: string;
  private _code: string;
  private _api: Comlink.RemoteObject<T>;
  private _worker: Worker;

  private constructor(
    path: string,
    code: string,
    worker: Worker,
    api: Comlink.RemoteObject<T>
  ) {
    this._path = path;
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
    return new NodeOmniWorker<T>(path, code, worker, api);
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

  public clone = async (options: IPoolOptions = {
    numOfWorkers: 1,
    freshCode: false
  }) => {

    const {
      numOfWorkers,
      freshCode
    } = options;

    const _numOfWorkers = numOfWorkers === undefined ? 1 : numOfWorkers;

    const freshFns: (() => Promise<NodeOmniWorker<T>>)[] = [];
    const unFreshWorkers: NodeOmniWorker<T>[] = [];
    const path = this._path;
    const code = this._code;

    // If static code should be re-used
    if (!freshCode) {
      for (let i = 0; i <= _numOfWorkers; i++) {
        const { worker, api } = buildNodeApiAndWorkerFromCode<T>(code);
        unFreshWorkers.push(new NodeOmniWorker<T>(path, code, worker, api));
      }
      return unFreshWorkers;
    }

    // If new code should be built each time
    else {
      for (let i = 0; i <= _numOfWorkers; i++) {
        const fn = async (): Promise<NodeOmniWorker<T>> => {
          const code = await genWorkerCodeFromFile(path);
          const { worker, api } = buildNodeApiAndWorkerFromCode<T>(code);
          return new NodeOmniWorker<T>(path, code, worker, api);
        }
        freshFns.push(fn);
      }
      const freshWorkers = await Promise.all(freshFns.map(fn => fn()));
      return freshWorkers;
    }
  }

  public destroy = async () => {
    await this._worker.terminate();
  }
}