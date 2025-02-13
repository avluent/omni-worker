import { capitalize } from "lodash"
import { swe_julday} from 'swisseph';

export interface TestWorkerModel {
  add: (a: number, b: number) => number
}

export interface TestImportWorkerModel {
  capitalize: typeof capitalize
}

export interface TestNativeWorkerModel {
  swe_julday: typeof swe_julday
}