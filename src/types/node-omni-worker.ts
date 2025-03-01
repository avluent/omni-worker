import { RemoteObject } from 'comlink/dist/umd/comlink';

/**
 * The base Interface for all workers
*/
export interface IOmniWorker<T> {
  /**
   * Use this function to see if the worker(pool) was successfully initialized
   * 
   * @returns A boolean on whether or not the OmniWorker was successfully initialized
   */
  isInitialized: () => boolean

  /**
   * Will let you use the worker functions that were exposed from inside the worker(pool).
   * Please not that since using the worker, all your functions will now return
   * asynchronously (Promise<T>).
   * 
   * @returns An object with the worker functions that were exposed from the worker
   */
  use: () => RemoteObject<T>

  /**
   * Terminates the underlying worker(s)
   */
  destroy: () => Promise<void>
}

/**
 * Defines whether the class is buildable, meaning that class can be made into
 * a NodeOmniWorker type.
 */
export interface IBuildable {
  build: <T>(path: string) => Promise<IOmniWorker<T>>
}

/**
 * Defines whether the class can expose code from the module user to the main thread.
 */
export interface IExposable {
  expose: <T>(exposable: T) => void
}

/**
 * A pool with multiple OmniWorkers
 */
export interface IOmniWorkerPool<T> extends IOmniWorker<T> {
  /**
   * Retrieves the number of workers that were initialized for the pool
   */
  getNumOfWorkers: () => number
}
  
/**
 * Determines whether an OmniWorker pool is able to build and launch
 * OmniWorkers
 */
export interface ILaunchable {
  /**
   * First builds the OmniWorkers and then launches a new OmniWorker pool
   * @param from The (relative) file path from your project's root to the worker .ts file
   * @param options (Optional) Options object for launching the pool
   */
  buildAndLaunch<T>(
    from: string,
    options?: IOmniWorkerPoolOptions
  ): Promise<IOmniWorkerPool<T>>

  /**
   * Launches a new OmniWorker pool according to the options provided
   * @param worker An already built OmniWorker
   * @returns A newly created pool
   */
  launch<T extends object>(
    worker: IOmniWorker<T>,
    options?: IOmniWorkerPoolOptions
  ): IOmniWorkerPool<T>
}

/**
 * Whether an IOmniWorker is able to be pooled
 */
export interface IPoolable<T> {
  /**
   * Clone an OmniWorker as many times as specified
   * @param numOfTimes how many times the item should be cloned
   * @returns a collection of OmniWorkers
   */
  clone: (numOfTimes: number) => IOmniWorker<T>[]
}

/**
 * Options for instantiation of a OmniWorkerPool
 */
export interface IPoolOptions {
  /**
   * The desired number of workers to be launched
   */
  numOfWorkers?: number
}

/**
 * The options for instantiating an OmniWorker pool
 */
export interface IOmniWorkerPoolOptions extends IPoolOptions { }