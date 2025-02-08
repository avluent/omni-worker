type ImportType = 'import'|'require';

export interface IImportRequire {
  type: ImportType,
  from: string
}

export interface IBinaryCheckedImportRequire extends IImportRequire {
  isBinary: boolean,
  dependsOnBinary: boolean,
  binaryPath?: string
}

export interface IBinaryMatch {
  packageName: string,
  binaryPath: string
}