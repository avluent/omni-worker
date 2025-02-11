import { TestBinaryImportWorkerModel } from "./worker-model";
import bcrypt from 'bcrypt';
import { getRounds } from 'bcrypt';
const sqlite3 = require("sqlite3");
import { NodeOmniWorker } from "../../src";
import swisseph from 'swisseph';

const functions: TestBinaryImportWorkerModel = {
  genSaltSync: bcrypt.genSaltSync,
  getRounds,
  getSqlEmpty: () => sqlite3.EMPTY || null,
  getJulianDay: swisseph.swe_julday
}

NodeOmniWorker.expose(functions);