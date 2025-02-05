import { OnLoadArgs, Plugin } from "esbuild";
import fs from 'fs';
import path from 'path';

const externalImportsPlugin: Plugin = ({
  name: 'external-imports-plugin',
  setup(build) {
    const externalModules: Set<string> = new Set();

    build.onLoad({ filter: /\.ts$|\.js$/ }, async (args: OnLoadArgs): Promise<any> => {
      // Read the file contents
      const code = fs.readFileSync(args.path, "utf8");

      // Collect imported module names
      const importPattern = /import\s+(?:[\s\w{},*]+from\s+)?["']([^"']+)["']/g;;
      let match;
      while ((match = importPattern.exec(code)) !== null) {
        let importPath = match[1];

        // Convert relative paths to absolute paths
        if (importPath.startsWith(".")) {
          importPath = path.resolve(path.dirname(args.path), importPath);

          // Strip project root to avoid absolute paths
          importPath = path.relative(process.cwd(), importPath);
        }

        externalModules.add(importPath);
      }
    });

    build.onResolve({ filter: /.*/ }, (args) => {
    if (externalModules.has(args.path)) {
      return { path: args.path, external: true }; // Mark it external
    }
    });

    build.onEnd(() => {
      build.initialOptions.external = [
        ...(build.initialOptions.external || []),
        ...Array.from(externalModules),
      ];

      console.log(build.initialOptions);
    });
  },
});

export default externalImportsPlugin;