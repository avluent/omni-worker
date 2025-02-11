import { capitalize } from "lodash"
import bcrypt from 'bcrypt';
import { getRounds } from "bcrypt";
import swisseph from "swisseph";

export interface TestWorkerModel {
  add: (a: number, b: number) => number
}

export interface TestImportWorkerModel {
  capitalize: typeof capitalize
}

export interface TestBinaryImportWorkerModel {
  genSaltSync: typeof bcrypt.genSaltSync,
  getRounds: typeof getRounds,
  getSqlEmpty: () => number|null,
  getJulianDay: typeof swisseph.swe_julday
}