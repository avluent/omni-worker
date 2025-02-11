import { readFileSync } from 'fs';
import { ICodePreProcessorOptions } from '../../types';
import { IImportRequire, TechType } from './model';
import { checkForNodeBinaryDependency, handleBinaryDependencies, parseImportRequire, scanForBinaryMatches } from './helpers';

export class CodePreProcessor {
  private _filePath?: string;
  private _techType?: TechType;

  private _inputCode: string;
  private _outputCode: string;

  private _options: ICodePreProcessorOptions;

  private constructor(
    code: string,
    options: ICodePreProcessorOptions = {},
    filePath?: string,
    techType?: TechType
  ) {
    this._inputCode = code;
    this._outputCode = code;
    this._options = options;
    this._filePath = filePath;
    this._techType = techType || filePath?.endsWith('js') ? 'js': 'ts';
  }

  /**
   * 
   * @param filePath Path to the source file
   * @param options Configuration options
   * @returns A new CodePreProcessor
   */
  static fromFile(
    filePath: string,
    options: ICodePreProcessorOptions = {}
  ): CodePreProcessor {
    try {
      const fileContents = readFileSync(filePath, {
        encoding: 'utf-8',
      });
      return new CodePreProcessor(
        fileContents,
        options,
        filePath
      );
    } catch(e) {
      throw new Error(`could not load code file: ${filePath}`);
    }
  }

  /**
   * Instantiate from a code string
   * @param code TS or JS code as a string
   * @param options Configuration options
   * @param techType TS or JS
   * @returns A new CodePreProcessor
   */
  static fromCode(
    code: string,
    techType: TechType,
    options: ICodePreProcessorOptions = {}
  ): CodePreProcessor {
    return new CodePreProcessor(
      code,
      options,
      undefined,
      techType
    );
  }

  /**
   * Retrieves the original code that was provided at instantiation
   * @returns The original code as a string
   */
  getInputCode = () => this._inputCode;
  
  /**
   * Retrieve the code that had already been manipulated
   * @returns Code that has already undergone manipulations
   */
  getOutputCode = () => this._outputCode;

  /**
   * See whether the file has dependencies on any .node binaries
   */
  getNodeBinaryDependencies = checkForNodeBinaryDependency;

  /**
   * This function will help find and .node files modules folder(s)
   */
  static scanForBinaryMatches = scanForBinaryMatches

  /**
   * Retrieve import and require statements from the code
   * @returns Import and require statements from the code as an ImportRequire
   * array
   */
  getImportRequireStatements(): IImportRequire[] {
    return parseImportRequire(this._inputCode);
  }

  /**
   * Which tech was used, TypeScript of JavaScript
   * @returns 'ts' or 'js'
   */
  getTechType = () => this._techType;

  /**
   * This will replace regular import statements with requires on binary
   * dependencies.
   * @returns Processed output code
   */
  /*
  processBinaryDependencies(): string {
    const importRequire = this.getImportRequireStatements();
    const deps = this.getNodeBinaryDependency(importRequire);
    const result = handleBinaryDependencies(this._inputCode, deps, this._techType || 'js');
    if (this._filePath?.includes(".worker")) {
      console.log(result);
    }
    this._outputCode = result;
    return result;
  }
  */
}