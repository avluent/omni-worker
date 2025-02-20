import { NodeOmniWorker } from "../../src/node"
import { TestWorkerModel } from "./worker-model";

const functions: TestWorkerModel = {
  add: (a: number, b: number) => a + b
}

NodeOmniWorker.expose(functions);