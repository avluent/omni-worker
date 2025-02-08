type ImportType = 'import'|'require';
export type TechType = 'js'|'ts';

export interface IImportRequire {
  type: ImportType,
  names: string[],
  from: string
}

export interface IBinaryCheckedImportRequire extends IImportRequire {
  isBinary: boolean,
  dependsOnBinary: boolean,
  binaryPath: string
}

export interface IBinaryMatch {
  packageName: string,
  binaryPath: string
}