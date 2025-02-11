import { OnLoadArgs, Plugin } from "esbuild";
import path from 'path';
import { CodePreProcessor } from "../../pre-processor";
import { isNodeCoreModule } from "../helpers";
import bcrypt from 'bcrypt';

const externalImportsPlugin = (callerDir: string): Plugin => {
  const plugin: Plugin = {
    name: 'external-imports-plugin',
    setup(build) {
      const internalizedModules: Set<string> = new Set();
      const externalModules: Set<string> = new Set();

      build.onLoad({ filter: /\.ts$|\.js$/ }, async (args: OnLoadArgs): Promise<any> => {
        const preProcessor = CodePreProcessor.fromFile(args.path);
        const importRequire = preProcessor.getImportRequireStatements();
        const binaryDependencies = preProcessor.getNodeBinaryDependencies(importRequire);
        const binaryDependencySources = binaryDependencies.map(bd => bd.from);

        for (const ir of importRequire) {

          const importPath = resolvePath(ir.from, args.path);

          // check whether the file includes a binary dependant module
          if (importRequire
              .map(ir => ir.from)
              .some(bd =>
                binaryDependencySources.includes(bd)
          )) {
            if (!isNodeCoreModule(ir.from)) {
              internalizedModules.add(importPath);
              continue;
            }
          }

          // check whether the file contains any already internalized modules
          if (importRequire.some(ir =>
            Array.from(internalizedModules).includes(ir.from)
          )) {
            if (!isNodeCoreModule(importPath)) {
              continue;
            }
          }

          externalModules.add(importPath);
        }
      });

      build.onResolve({ filter: /.*/ }, (args) => {

        // do binary processing when internalized into bundle
        if (args.path.endsWith('js') || args.path.endsWith('ts')) {
          if (internalizedModules.has(args.path)) {
            console.log('internalized: ', args.path)
            if (args.path.includes('bcrypt')) {
              console.log('bcrypt', args.path);
            }
          }
        }
      
        // mark external when should be externalized
        if (externalModules.has(args.path)) {
          return { path: args.path, external: true };
        }
      });

      build.onEnd(() => {
        const int = Array.from(internalizedModules);
        const ext = Array.from(externalModules);
        build.initialOptions.external = [
          ...(build.initialOptions.external || []),
          ...ext,
        ];
        console.log('external', ext, 'internal', int);
      });
    },
  }

  return plugin;
}

const resolvePath = (importPath: string, basePath: string): string => {
  if (importPath.startsWith(".")) {
    importPath = path.resolve(path.dirname(basePath), importPath);

    // Strip project root to avoid absolute paths
    importPath = path.relative(process.cwd(), importPath);
    return importPath;
  }
  return importPath;
}

export default externalImportsPlugin;