import { IBuildable, IExposable, IOmniWorker, IPoolable } from "../types";
import Comlink from 'comlink';
import { staticImplements } from "../types/helpers";

@staticImplements<IBuildable>()
@staticImplements<IExposable>()
export class WebOmniWorker<T> implements IOmniWorker<T>, IPoolable<T> {
  private _code: string;
  private _worker: Worker;
  private _api: Comlink.RemoteObject<T>;

  constructor(
    code: string,
    worker: Worker,
    api: Comlink.RemoteObject<T>
  ) {
    this._code = code;
    this._worker = worker;
    this._api = api;
    return this;
  }

  public static expose = <T>(functions: T): void => {
    throw new Error('not yet implemented');
  }

  public static async build<T>(path: string): Promise<WebOmniWorker<T>> {
    throw new Error('not yet implemented');
  }

  isInitialized = () => true;
  use = () => this._api;
  destroy = async () => {};
  clone = (numOfTimes: number) => [];
}