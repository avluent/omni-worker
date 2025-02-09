import * as Comlink from 'comlink';

/**
 * The base Interface for all workers
*/
export declare interface IOmniWorker<T> {
  
  /**
   * Use this function to see if the worker was successfully initialized
   * 
   * @returns A boolean on whether or not the OmniWorker was successfully initialized
   */
  isInitialized: () => boolean

  /**
   * Will let you use the worker functions that were exposed from inside the worker.
   * Please not that since using the worker, all your functions will now return
   * asynchronously (Promise<>).
   * 
   * @returns An object with the worker functions that were exposed from the worker
   */
  use: () => Comlink.Remote<T>
}

/**
 * The options when building a worker
 */
export declare interface INodeOmniWorkerBuildOptions {}