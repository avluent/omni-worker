import { IBuildable, IExposable, IOmniWorker, IPoolable } from "../types/web-omni-worker";
import * as Comlink from 'comlink/dist/esm/comlink';
import { staticImplements } from "../types/helpers";
import { buildWebApiAndWorker } from "./builder";

/**
 * OmniWorker for the web
 */
@staticImplements<IBuildable>()
@staticImplements<IExposable>()
export class WebOmniWorker<T> implements IOmniWorker<T>, IPoolable<T> {
  private _url: URL;
  private _worker: Worker;
  private _api: Comlink.RemoteObject<T>;

  constructor(
    url: URL,
    worker: Worker,
    api: Comlink.RemoteObject<T>
  ) {
    this._url = url;
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
   * @param path Relative path from the INVOCATION POINT OF THIS FUNCTION to the file
   * to be the worker
   * @returns An OmniWorker
   */
  public static async build<T>(url: URL): Promise<WebOmniWorker<T>> {
    const { worker, api } = buildWebApiAndWorker<T>(url);
    return new WebOmniWorker(url, worker, api);
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
    for (let i = 0; i <= numOfTimes; i++) {
      const { worker, api } = buildWebApiAndWorker<T>(url);
      workers.push(new WebOmniWorker<T>(url, worker, api));
    }
    return workers;
  };
}