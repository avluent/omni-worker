/*
import bcrypt from 'bcrypt';
import { getRounds } from 'bcrypt';
const sqlite3 = require("sqlite3");
*/
import swisseph from "swisseph";
import { NodeOmniWorker } from "../../src";

const functions = {
  /*
  genSaltSync: bcrypt.genSaltSync,
  getRounds,
  getSqlEmpty: () => sqlite3.EMPTY || null
  */
  getJulianDay: swisseph.swe_julday
}

NodeOmniWorker.expose(functions);