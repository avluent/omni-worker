export type JsExtension = '.cjs' | '.mjs' | '.js';

/**
 * The options provided to the `provideWorker(url, options)` function
 */
export interface WebOmniWorkerBuilderOptions {
  /**
   * The bundler's target extension (defaults to .js)
   */
  extension?: JsExtension
}