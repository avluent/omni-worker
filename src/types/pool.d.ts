import { IOmniWorker } from "./omni-worker"

/**
 * A pool with multiple OmniWorkers
 */
export interface IOmniWorkerPool<T> extends IOmniWorker<T> { }

export interface IPoolable<T> {
  /**
   * Clone an OmniWorker as many times as specified
   * @param numOfTimes how many times the item should be cloned
   * @returns a collection of OmniWorkers
   */
  clone: (numOfTimes: number) => IOmniWorker<T>[]

  /**
   * Launches a pool from a single OmniWorker
   * @param options 
   * @returns A new OmniWorkerPool instance
   */
  toPool: <T extends object>(options: IPoolOptions) => IOmniWorkerPool<T>
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
