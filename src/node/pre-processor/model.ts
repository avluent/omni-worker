type ImportType = 'import'|'require';
export type TechType = 'js'|'ts';

export interface IImportRequire {
  type: ImportType,
  importedNames: string[],
  localNames: string[],
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