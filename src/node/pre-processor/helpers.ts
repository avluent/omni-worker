import { parse, ParseResult } from "@babel/parser";
import * as t from '@babel/types';
import { IBinaryCheckedImportRequire, IBinaryMatch, IImportRequire, TechType } from "./model";
import path from "path";
import { readdirSync, statSync } from "fs";

const parseCode = (code: string): ParseResult<t.File> => {
  const ast = parse(code, {
    sourceType: 'module',
    errorRecovery: true,
    plugins: ['typescript']
  });
  return ast;
}

const isValidImport = (node?: t.Statement): node is t.ImportDeclaration => {
  if (!node) return false;
  return t.isImportDeclaration(node);
}

const isValidRequire = (node?: t.Statement): node is t.ExpressionStatement => {
  return Boolean (
    node &&
    t.isExpressionStatement(node) &&
    t.isCallExpression(node.expression) &&
    t.isIdentifier(node.expression.callee) &&
    node.expression.callee.name === 'require'
  );
}

export const parseImportRequire = (code: string): IImportRequire[] => {
  try {
    const imports: IImportRequire[] = [];
    const ast = parseCode(code);
    ast.program.body.forEach((node) => {
      // imports
      if (t.isImportDeclaration(node)) {
        imports.push({
          type: 'import',
          importedNames: node.specifiers
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
          localNames: node.specifiers
            .map(s => {
              if (t.isImportDefaultSpecifier(s)) {
                if (t.isIdentifier(s.local)) {
                  return s.local.name;
                }
              }
              return undefined;
            })
            .filter(n => n !== undefined),
          from: node.source.value
        });
      }
      
      // requires
      if (
        isValidRequire(node) &&
        t.isCallExpression(node.expression) &&
        t.isIdentifier(node.expression.callee) &&
        t.isStringLiteral(node.expression.arguments[0])
      )
      {
        const firstArgument = node.expression.arguments[0];
        imports.push({
          type: 'require',
          localNames: [],
          importedNames: [],
          from: firstArgument.value
        });
      }
    });

    return imports;
  } catch (e) {
    throw(e)
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
      localNames,
      importedNames,
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
          localNames,
          importedNames,
          dependsOnBinary: match.binaryPath.endsWith('.node'),
          isBinary: imp.from.endsWith('.node'),
          binaryPath: match.binaryPath
        });
      }
    } catch (e) {
      // fail silently
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
  
  const resultLines: string[] = [];
  for (const line of lines) {

    // only use import/require lines
    const getLineNode = () => {
      try {
        const lineNode = parseCode(line).program.body[0];
        return lineNode
      } catch(e) {
        // do nothing
      }
    }
    if (
      isValidImport(getLineNode()) ||
      isValidRequire(getLineNode())
    ) {
      var importRequires: IImportRequire[] = [];
      try {
        importRequires = parseImportRequire(line);
        if (importRequires.length < 1) continue;
      } catch(e) {
        resultLines.push(line);
        continue;
      }

      var filteredImportRequires = importRequires
        .filter(ir => {
          return Boolean(
            line.includes(ir.from) &&
            [
              ...ir.localNames,
              ...ir.importedNames
            ].some(n => line.includes(n))
          );
        });
      
      if (filteredImportRequires.length !== 1) {
        resultLines.push(line);
        continue;
      }

      const ir = filteredImportRequires[0];
      const dep = deps.find(d => {
        return Boolean(
          d.from === ir.from &&
          JSON.stringify(d.localNames) === JSON.stringify(ir.localNames) &&
          JSON.stringify(d.importedNames) === JSON.stringify(ir.importedNames)
        );
      })

      if (dep === undefined) {
        resultLines.push(line);
        continue;
      }

      if (deps.some(d => line.includes(d.from))) {
        const { localNames, importedNames, from, binaryPath } = dep;
        const cast = ` as typeof import('${from}')` 

        // check for named imports
        let depLine = "";
        const hasLocalNames = localNames.length > 0;
        const hasImportedNames = importedNames.length > 0;
        if (hasImportedNames && !hasLocalNames) {
          depLine = `const { ${importedNames.join(', ')} } = require('${binaryPath}')${techType === 'ts' ? cast : ''};`
        } else if (hasImportedNames && hasLocalNames) {
          depLine = `const { ${importedNames.join(', ')} } = require('${binaryPath}')${techType === 'ts' ? cast : ''};`
          for (const name of localNames) {
            depLine += `\nconst ${name} = require('${binaryPath}')${techType === 'ts' ? cast : ''};`
          }
        } else if (!hasImportedNames && hasLocalNames) {
          for (const name of localNames) {
            depLine += `\nconst ${name} = require('${binaryPath}')${techType === 'ts' ? cast : ''};`
          }
        } else {
          depLine = `const ${from} = require('${binaryPath}')${techType === 'ts' ? cast : ''};`
        }

        resultLines.push(depLine);
        continue;
      }
    }
    resultLines.push(line);
  }

  return resultLines.join('\n');
}