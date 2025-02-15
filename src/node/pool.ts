import { NodeOmniWorker } from ".";
import { IOmniWorkerPool, IOmniWorkerPoolOptions } from "../types/pool.d";

export class NodeOmniWorkerPool<T> implements IOmniWorkerPool<T> {

  private _pool: NodeOmniWorker<T>[] = [];
  private _from: NodeOmniWorker<T>;
  private _options: IOmniWorkerPoolOptions;
  private _count: number = 0;
  private _lastUseIdx: number = -1;

  private constructor(
    from: NodeOmniWorker<T>,
    options?: IOmniWorkerPoolOptions
  ) {
    this._from = from;
    this._options = options || { numOfWorkers: 1 };
  }

  /**
   * First builds the OmniWorkers and then launches a new NodeOmniWorker pool
   * @param from The (relative) file path from your project's root to the worker .ts file
   * @param options (Optional) Options object for launching the pool
   */
  public static async buildAndLaunch<T extends object>(
    from: string,
    options?: IOmniWorkerPoolOptions
  ): Promise<NodeOmniWorkerPool<T>> {
    const worker = await NodeOmniWorker.build<T>(from);
    const pool = await NodeOmniWorkerPool.launch<T>(worker, options);
    return pool;
  }

  /**
   * Launches a new NodeOmniWorker pool according to the options provided
   * @param worker An already built NodeOmniWorker
   * @returns A newly created pool
   */
  private static async launch<T extends object>(
    worker: NodeOmniWorker<T>,
    options?: IOmniWorkerPoolOptions
  ): Promise<NodeOmniWorkerPool<T>> {
    const pool = new NodeOmniWorkerPool<T>(worker, options);
    await pool.applyOptions(options);
    return pool;
  }

  /**
   * Applies the options provided
   */
  private async applyOptions(options: IOmniWorkerPoolOptions = {
    numOfWorkers: 1,
    freshCode: false
  }) {
    const {
      numOfWorkers,
      freshCode
    } = options;

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
      this._pool = await this._from.clone({
        numOfWorkers: count,
        freshCode
      });
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