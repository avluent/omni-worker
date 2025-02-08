import { parse } from "@babel/parser";
import * as t from '@babel/types';
import { IBinaryCheckedImportRequire, IBinaryMatch, IImportRequire, TechType } from "./model";
import path from "path";
import { readdirSync, statSync } from "fs";

const getImportsFromCode = (code: string): string => 
  (code.match(/(import .*|require.*)/g) || []).join('\n');

export const parseImportRequire = (code: string) => {
  const importsOnly = getImportsFromCode(code);

  try {
    const ast = parse(importsOnly, { sourceType: 'unambiguous', });
    const imports: IImportRequire[] = [];
    ast.program.body.forEach((node) => {
      // imports
      if (node.type === 'ImportDeclaration') {
        imports.push({
          type: 'import',
          names: node.specifiers
            .map(s => {
              if (t.isImportSpecifier(s)) {
                if (t.isIdentifier(s.imported)) {
                  return s.imported.name;
                }
                if (t.isStringLiteral(s.imported)) {
                  return s.imported.value;
                } 
              }
              return undefined;
            })
            .filter(n => n !== undefined),
          from: node.source.value
        });
      }
      
      // requires
      if (node.type === 'ExpressionStatement' && node.expression.type === 'CallExpression') {
        const callExpression = node.expression;
        if (callExpression.callee.type === 'Identifier' && callExpression.callee.name === 'require') {
          const firstArgument = callExpression.arguments[0];
          if (firstArgument && firstArgument.type === 'StringLiteral') {
            imports.push({ type: 'require', names: [], from: firstArgument.value });
          }
        }
      }
    });

    return imports;
  } catch (e) {
    console.error(e);
    return [];
  }
}

export const checkForNodeBinaryDependency = (
  imports: IImportRequire[]
): IBinaryCheckedImportRequire[] => {

  const nodePath = process.env.NODE_PATH;
  const defaultNodeModulesPath = path.resolve('./node_modules');
  const searchPaths = [defaultNodeModulesPath];
  if (nodePath) searchPaths.push(nodePath);

  const result: IBinaryCheckedImportRequire[] = [];
  for (const imp of imports) {
    const {
      from,
      names,
      type
    } = imp;
    try {
      const matches = scanForBinaryMatches(imp.from, searchPaths);
      const numOfMatches = matches.length;
      if (numOfMatches === 1) {
        const match = matches[0];
        result.push({
          from,
          type,
          names,
          dependsOnBinary: match.binaryPath.endsWith('.node'),
          isBinary: imp.from.endsWith('.node'),
          binaryPath: match.binaryPath
        });
      }
    } catch (e) {
      // console.warn(e)
    }
  } 
  return result;
}

export const scanForBinaryMatches = (
  packageName: string,
  modulesPaths: string[]
): IBinaryMatch[] => {

  const results: IBinaryMatch[] = [];

  for (const modulePath of modulesPaths) {
    const packageDir = path.join(modulePath, packageName);
    const walkDirectory = (directory: string, files: IBinaryMatch[] = []) => {
      const lsResult = readdirSync(directory);

      lsResult.forEach(item => {
        const fullPath = path.join(directory, item);
        const stat = statSync(fullPath);

        if (stat.isDirectory()) {
          walkDirectory(fullPath, files);
        } else {
          if (fullPath.endsWith('.node')) {
            files.push({
              packageName: packageName,
              binaryPath: fullPath
            });
          }
        }
      });
      return files;
    }
    const matches: IBinaryMatch[] = [];
    walkDirectory(packageDir, matches);
    results.push(...matches);
  }
  return results;
}

export const handleBinaryDependencies = (
  code: string,
  deps: IBinaryCheckedImportRequire[],
  techType: TechType
): string => {

  const lines = code.split('\n');
  const depTargets = deps.map(d => d.from);
  
  const resultLines: string[] = [];
  for (const line of lines) {

    if (line.includes('import') || line.includes('require')) {
      var idx = -1;
      if (depTargets.some(dt => {
        const isIncluded = line.includes(dt);
        if (isIncluded) {
          idx = depTargets.indexOf(dt);
          return isIncluded;
        }
        return false;
      })) {
        const dep = deps[idx];
        const { from, binaryPath } = dep;
        const cast = ` as typeof import('${from}')` 
        const depLine = `const ${from} = require('${binaryPath}')${techType === 'ts' ? cast : ''};`
        resultLines.push(depLine);
        continue;
      }
    }
    resultLines.push(line);
  }

  return resultLines.join('\n');
}