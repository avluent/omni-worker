import { NodeOmniWorker } from "../../src";
import { TestNativeWorkerModel } from "./worker-model";
import { swe_julday } from 'swisseph';

const functions: TestNativeWorkerModel = {
  swe_julday
}

NodeOmniWorker.expose(functions);