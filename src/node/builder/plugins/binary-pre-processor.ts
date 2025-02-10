import { Plugin } from "esbuild";
import { WorkerFilePreProcessor } from "../../pre-processor";

export const binaryPreProcessorPlugin: Plugin = {
  name: 'binary pre-processor', 
  setup(build) {
    build.onLoad({ filter: /\.(ts|js)$/ }, async (args) => {

      // replace binary deps
      const processor = WorkerFilePreProcessor.fromFile(args.path);
      let modifiedSource = processor.processBinaryDependencies();

      // define loader type
      const loaderType = args.path.endsWith('.ts') ? 'ts' : 'js';

      return {
        contents: modifiedSource,
        loader: loaderType,
      };
    });
  },
}