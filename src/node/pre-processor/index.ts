import { readFileSync } from 'fs';
import { IWorkerFilePreProcessorOptions } from '../../types';
import { IImportRequire, TechType } from './model';
import { checkForNodeBinaryDependency, handleBinaryDependencies, parseImportRequire } from './helpers';

export class WorkerFilePreProcessor {
  private _inputCode: string;
  private _outputCode: string;
  private _techType: TechType;
  private _options: IWorkerFilePreProcessorOptions;

  constructor(
    filePath: string,
    options: IWorkerFilePreProcessorOptions = {}
  ) {
    this._options = options;
    this._techType = filePath.endsWith('js') ? 'js': 'ts';
    try {
      const fileContents = readFileSync(filePath, {
        encoding: 'utf-8',
      });
      this._inputCode = fileContents;
      this._outputCode = fileContents;
    } catch(e) {
      throw new Error("could not load worker file");
    }
    return this;
  }

  checkForNodeBinaryDependency = checkForNodeBinaryDependency;

  getImportRequireStatements(): IImportRequire[] {
    return parseImportRequire(this._inputCode);
  }

  getTechType = () => this._techType;

  processBinaryDependencies(): string {
    const importRequire = this.getImportRequireStatements();
    const deps = this.checkForNodeBinaryDependency(importRequire);
    const result = handleBinaryDependencies(this._inputCode, deps, this._techType);
    this._outputCode = result;
    return result;
  }
}