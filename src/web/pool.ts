import { WebOmniWorker } from ".";
import { staticImplements } from "../types/helpers";
import { ILaunchable, IOmniWorkerPool, IOmniWorkerPoolOptions, IWebOmniWorkerBuilderOptions } from "../types/web-omni-worker";

@staticImplements<ILaunchable>()
export class WebOmniWorkerPool<T> implements IOmniWorkerPool<T> {

  private _pool: WebOmniWorker<T>[] = [];
  private _from: WebOmniWorker<T>;
  private _options: IWebOmniWorkerBuilderOptions & IOmniWorkerPoolOptions;
  private _count: number = 0;
  private _lastUseIdx: number = -1;

  private constructor(
    from: WebOmniWorker<T>,
    options?: IOmniWorkerPoolOptions
  ) {
    this._from = from;
    this._options = options || { numOfWorkers: 1 };
    this.applyOptions();
  }

  /**
   * First builds the OmniWorkers and then launches a new WebOmniWorker pool
   * @param url A URL with the relative file path to the worker .ts file
   * @param options (Optional) Options object for launching the pool
   */
  public static async buildAndLaunch<T>(
    url: URL,
    options: IWebOmniWorkerBuilderOptions & IOmniWorkerPoolOptions = {
      extension: '.js',
      numOfWorkers: navigator?.hardwareConcurrency || 1
    }
  ): Promise<WebOmniWorkerPool<T>> {
    const worker = await WebOmniWorker.build<T>(url, options);
    const pool: WebOmniWorkerPool<T> = WebOmniWorkerPool.launch<T>(worker, options);
    return pool;
  }

  /**
   * Launches a new WebOmniWorker pool according to the options provided
   * @param worker An already built WebOmniWorker
   * @returns A newly created pool
   */
  static launch<T>(
    worker: WebOmniWorker<T>,
    options?: IWebOmniWorkerBuilderOptions & IOmniWorkerPoolOptions
  ): WebOmniWorkerPool<T> {
    const pool = new WebOmniWorkerPool<T>(worker, options);
    return pool;
  }

  /**
   * Applies the options provided
   */
  private applyOptions() {
    const { numOfWorkers } = this._options;

    let count = 0;
    if (numOfWorkers === undefined) {
      count = 1;
    } else {
      count = numOfWorkers;
    }

    if (count < 1) {
      throw Error(`number of workers must be at least 1`);
    }
    this._count = count;
    for (let i = 0; i <= count; i++) {
      this._pool = this._from.clone(count);
    }
  }

  public isInitialized = () => this._count > 0;

  public getNumOfWorkers = () => this._count;

  public use = () => {
    if (!this.isInitialized()) {
      return this._from.use();
    } else {
      const lastIdx = this._lastUseIdx;

      // first run or maxed out
      if (
        lastIdx === this._count - 1 ||
        lastIdx === -1
      ) {
        this._lastUseIdx = 0;
        return this._pool[0].use();
      
      // any other run
      } else {
        this._lastUseIdx = lastIdx + 1;
        return this._pool[lastIdx + 1].use();
      }
    }
  }

  public destroy = async () => {
    const fns:(() => Promise<void>)[] = [];
    this._pool.forEach(w => {
      const fn = async () => {
        await w.destroy();
      }
      fns.push(fn);
    });
    await Promise.all(fns.map(fn => fn()));
  }
}