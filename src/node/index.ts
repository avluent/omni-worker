import { IOmniWorker } from '../types/index.d';
import { parentPort, Worker } from 'worker_threads';
import * as Comlink from 'comlink';
import nodeEndpoint from 'comlink/dist/umd/node-adapter';
import { buildApiNode } from '../builder/node';

export class NodeOmniWorker<T> implements IOmniWorker<T> {
  private _api: Comlink.Remote<T>;
  private _worker: Worker;

  private constructor(
    api: Comlink.Remote<T>,
    worker: Worker
  ) {
    this._api = api;
    this._worker = worker;
    return this;
  }

  /**
   * Expose the functions inside the worker to the rest of the application.
   * After having exposed the functions, the build step can be initiated.
   * @param functions An object with functions inside the worker to be exposed to
   * the rest of the application.
   */
  public static expose = <T>(functions: T) => {
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
    const { api, worker } = await buildApiNode<T>(path);
    return new NodeOmniWorker<T>(api, worker);
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

  public destroy = async () => {
    await this._worker.terminate();
  }
}