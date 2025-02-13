import { TsConfigOptions } from "ts-node";
import ts  from "typescript";

export const tsCompilerOptions: ts.CompilerOptions = {
  module: ts.ModuleKind.CommonJS,
  target: ts.ScriptTarget.ES2018,
}

export const tsNodeCompilerOptions: TsConfigOptions = {
  transpileOnly: true,
  compilerOptions: {
    module: 'CommonJS',
    target: 'ES5'
  }
}