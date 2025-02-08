import { capitalize } from "lodash"
import bcrypt from 'bcrypt';
import { getRounds } from "bcrypt";

export interface TestWorkerModel {
  add: (a: number, b: number) => number
}

export interface TestImportWorkerModel {
  capitalize: typeof capitalize
}

export interface TestBinaryImportWorkerModel {
  genSaltSync: typeof bcrypt.genSaltSync,
  getRounds: typeof getRounds,
  getSqlEmpty: () => number|null
}