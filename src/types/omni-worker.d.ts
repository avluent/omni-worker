import Comlink from 'comlink';

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
  use: () => Comlink.RemoteObject<T>

  /**
   * Terminates the underlying worker(s)
   */
  destroy: () => Promise<void>
}

/**
 * Defines whether the class is buildable, meaning that class can be made into
 * a OmniWorker type.
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