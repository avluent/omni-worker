import { readFileSync } from 'fs';
import { IWorkerFilePreProcessorOptions } from '../../types';
import { IImportRequire } from './model';
import { checkForNodeBinaryDependency, parseImportRequire } from './helpers';

export class WorkerFilePreProcessor {
  private _inputCode: string;
  private _outputCode: string;
  private _options: IWorkerFilePreProcessorOptions;

  constructor(
    filePath: string,
    options: IWorkerFilePreProcessorOptions = {}
  ) {
    this._options = options;
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
}