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

export interface IPoolable<T> {
  /**
   * Clone an OmniWorker as many times as specified
   * @param numOfTimes how many times the item should be cloned
   * @returns a collection of OmniWorkers
   */
  clone: (options: IPoolOptions) => Promise<IOmniWorker<T>[]>
}

/**
 * Options for instantiation of a OmniWorkerPool
 */
export interface IPoolOptions {
  /**
   * The desired number of workers to be launched
   */
  numOfWorkers?: number

  /**
   * Determines whether the code is built freshly for each worker.
   * This is recommended for workers that depend on .node native code.
   * Setting this to true will significantly increase warm-up time.
   */
  freshCode?: boolean
}

/**
 * The options for instantiating an OmniWorker pool
 */
export interface IOmniWorkerPoolOptions extends IPoolOptions { }