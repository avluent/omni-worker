import { scanForBinaryMatches } from '../src/node/pre-processor/helpers';
import { IBinaryMatch } from '../src/node/pre-processor/model';
import { CodePreProcessor } from '../src/node/pre-processor/index'
import { MOCK_DIR } from './mock/contstants';
import { NodeOmniWorker } from '../src';
import { TestBinaryImportWorkerModel } from './mock/worker-model';
import swisseph from 'swisseph';

const moduleDir = './node_modules';
const packages = ['bcrypt', 'sqlite3'];

test('all binaries are returned', async () => {
  const binaryMatches: IBinaryMatch[][] = [];
  for (const pckg of packages) {
    const matches = scanForBinaryMatches(pckg);
    binaryMatches.push(matches);
  }
  expect(binaryMatches.flat().length).toBe(2);
});

test('import and required statements are resolved', () => {
  const processor = CodePreProcessor
    .fromFile(`${MOCK_DIR}/binary.worker.ts`);

  const importRequire = processor.getImportRequireStatements();
  // console.log(importRequire);
  expect(importRequire.length).toBe(6);
});

test('binary dependencies are being picked up on', () => {
  const processor = CodePreProcessor
    .fromFile(`${MOCK_DIR}/binary.worker.ts`);

  const importRequire = processor.getImportRequireStatements();
  const binaryDependencies = processor.getNodeBinaryDependencies(importRequire);
  expect(binaryDependencies.length).toBe(2);
});

/*
test('binary dependency imports are being swapped out by binary requires', () => {
  const processor = CodePreProcessor
    .fromFile(`${MOCK_DIR}/binary.worker.ts`);
  
  const resultCode = processor.processBinaryDependencies();
  // console.log('.ts code:\n', resultCode);
  expect(resultCode).toBeDefined();
});
*/

test('binary dependency pre-processing also works on .js', () => {
  const processor = CodePreProcessor
    .fromFile(`${MOCK_DIR}/binary.worker.js`);

  const code = processor.getOutputCode();
  
  // console.log('.js code:\n', resultCode);
  expect(code).toBeDefined();
});

test('calling a function that depends on a binary', async () => {
  const worker = await NodeOmniWorker
    .build<TestBinaryImportWorkerModel>(`${MOCK_DIR}/binary.worker`);

  console.log(worker);
  const isInitialized = worker.isInitialized();
  expect(isInitialized).toBeTruthy();

  const julDay = await worker.use().getJulianDay(2022, 12, 14, 12, swisseph.SE_GREG_CAL);
  const msg = await worker.use().getWorkerData();
  // const julDay = await worker.use().getJulianDay();
  console.log("julian day:", julDay, 'msg', msg);
  expect(julDay).toBeDefined();
});