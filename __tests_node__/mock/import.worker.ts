import { NodeOmniWorker } from "../../src/node";
import { capitalize } from "lodash";
import { TestImportWorkerModel } from "./worker-model";

const functions: TestImportWorkerModel = {
  capitalize
}

NodeOmniWorker.expose(functions);