import { buildApiNode, exposeApiNode } from './builder/node';
import { IOmniWorker } from './types/omni-worker';
import * as Comlink from 'comlink';

export class NodeOmniWorker<T extends Record<string, Function>> implements IOmniWorker<T> {
  private _api: Comlink.Remote<T>;
  private _functions?: T;

  private constructor(api: Comlink.Remote<T>) {
    this._api = api;
    return this;
  }

  public static async build<T extends {[key: string]: Function}>(
    path: string
  ): Promise<IOmniWorker<T>> {
    const api = await buildApiNode<T>(path);
    return new NodeOmniWorker<T>(api);
  }

  public set<T>(functions: T) {
    if (this._functions === undefined) {
      (this._functions as any) = functions;
      exposeApiNode(functions);
    }
  }

  public checkIfInitialized = (): boolean => (
    this._api !== undefined &&
    this._functions !== undefined
  );

  public start = () => {
    const isInitialized = this.checkIfInitialized();
    if (isInitialized) {
      return this._functions!;
    } else {
      throw Error('worker is not yet initialized. make sure to call the .set() function, first');
    }
  }
}