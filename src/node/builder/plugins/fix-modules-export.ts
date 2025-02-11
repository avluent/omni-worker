import { Plugin } from "esbuild";
import fs from 'fs';

export const modulesExportFixPlugin = (): Plugin => {

  const plugin: Plugin = {
  name: "fix-module-exports",
    setup(build) {

      build.onLoad({ filter: /.*/ }, (args) => {
        return {}
      })

      build.onEnd((result) => {
          const filePath = 'build/swisseph.js';

          console.log('processsing', filePath);
          let code = fs.readFileSync(filePath, "utf8").split('\n');

          // console.log(code);

          // const exportStringRegex = /module\.exports\s*=\s*['"]([^'"]+)['"];/g;
          // const exportStringRegex = /module\.exports\s*=\s*(.*?);?\s*/gs;
          const exportStringRegex = /^(module\.exports|exports)(\ ?=\ ?)(\w+)/gs;

          const resultLines: string[] = [];
          for (const line of code) {
            const match = line.matchAll(exportStringRegex);
            let isNewLine = false;
            for (const m of match) {
              const modulePath = m[3];
              const newLine = `module.exports = require(${modulePath});`
              resultLines.push(newLine);
              isNewLine = true;
              break;
            }
            
            if (!isNewLine) {
              resultLines.push(line);
            }
          }

          const fixedCode = resultLines.join('\n');
          fs.writeFileSync(filePath, fixedCode, "utf8");
      });
    },
  }
  
  return plugin;
};