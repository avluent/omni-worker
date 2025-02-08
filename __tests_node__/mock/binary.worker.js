import bcrypt from 'bcrypt';
import { getRounds } from 'bcrypt';
const sqlite3 = require("sqlite3");
import { NodeOmniWorker } from "../../src";

const functions = {
  genSaltSync: bcrypt.genSaltSync,
  getRounds,
  getSqlEmpty: () => sqlite3.EMPTY || null
}

NodeOmniWorker.expose(functions);