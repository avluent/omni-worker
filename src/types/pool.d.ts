import { IOmniWorker } from "./omni-worker"

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
