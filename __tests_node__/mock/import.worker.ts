import { NodeOmniWorker } from "../../src";
import { capitalize } from "lodash";
import { TestImportWorkerModel } from "./worker-model";

const functions: TestImportWorkerModel = {
  capitalize
}

NodeOmniWorker.expose(functions);