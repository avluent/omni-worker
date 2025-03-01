import { IBuildable, IExposable, IOmniWorker, IPoolable } from "../types/web-omni-worker";
import * as Comlink from 'comlink/dist/esm/comlink';
import { staticImplements } from "../types/helpers";
import { buildWebApiAndWorker } from "./builder";
import { IWebOmniWorkerBuilderOptions } from "../web";

/**
 * OmniWorker for the web
 */
@staticImplements<IBuildable>()
@staticImplements<IExposable>()
export class WebOmniWorker<T> implements IOmniWorker<T>, IPoolable<T> {
  private _url: URL;
  private _options: IWebOmniWorkerBuilderOptions;
  private _worker: Worker;
  private _api: Comlink.RemoteObject<T>;

  constructor(
    url: URL,
    options: IWebOmniWorkerBuilderOptions,
    worker: Worker,
    api: Comlink.RemoteObject<T>
  ) {
    this._url = url;
    this._options = options;
    this._worker = worker;
    this._api = api;
    return this;
  }

  /**
   * Expose the functions inside the worker to the rest of the application.
   * After having exposed the functions, the build step can be initiated.
   * @param exposable A class, object with functions or a single function to be
   * exposed to the main thread.
   */
  public static expose = <T>(exposable: T): void => {
    Comlink.expose(exposable);
  }

  /**
   * Handles the building of the necessary resources for an OmniWorker to function.
   * This usually means, building from the consumer's code, creating the comlink
   * interface between the worker and the main thread as well as the worker itself.
   * 
   * @param tsUrl A URL object linking to the worker .ts file
   * @param options Builder options
   * @returns A WebOmniWorker
   */
  public static async build<T>(
    tsUrl: URL,
    options: IWebOmniWorkerBuilderOptions = {
      extension: '.js'
    }
  ): Promise<WebOmniWorker<T>> {
    const { jsUrl, worker, api } = buildWebApiAndWorker<T>(tsUrl, options);
    return new WebOmniWorker(jsUrl, options, worker, api);
  }

  isInitialized = () => this._api !== undefined;

  use = () => {
    const isInitialized = this.isInitialized();
    if (isInitialized) {
      return this._api!;
    } else {
      throw Error(`worker is not yet initialized. make sure to call the build() function, first`);
    }
  }

  destroy = async () => {
    this._worker?.terminate();
  };

  clone = (numOfTimes: number) => {
    const workers: WebOmniWorker<T>[] = [];
    const url = this._url;
    const options = this._options;
    for (let i = 0; i <= numOfTimes; i++) {
      const { worker, api } = buildWebApiAndWorker<T>(url, options);
      workers.push(new WebOmniWorker<T>(url, options, worker, api));
    }
    return workers;
  };
}