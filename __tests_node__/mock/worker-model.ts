import { capitalize } from "lodash"
import bcrypt from 'bcrypt';
import sqlite3 from 'sqlite3';

export interface TestWorkerModel {
  add: (a: number, b: number) => number
}

export interface TestImportWorkerModel {
  capitalize: typeof capitalize
}

export interface TestBinaryImportWorkerModel {
  genSaltSync: typeof bcrypt.genSaltSync,
  getSqlEmpty: () => number|null
}