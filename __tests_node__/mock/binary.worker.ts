import { TestBinaryImportWorkerModel } from "./worker-model";
import bcrypt from 'bcrypt';
const sqlite3 = require("sqlite3");
import { NodeOmniWorker } from "../../src";

const functions: TestBinaryImportWorkerModel = {
  genSaltSync: bcrypt.genSaltSync,
  getSqlEmpty: () => sqlite3.EMPTY || null
}

NodeOmniWorker.expose(functions);