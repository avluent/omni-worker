import { scanForBinaryMatches } from '../src/node/pre-processor/helpers';
import { IBinaryMatch } from '../src/node/pre-processor/model';
import { WorkerFilePreProcessor } from '../src/node/pre-processor/index'
import { MOCK_DIR } from './mock/contstants';
import { NodeOmniWorker } from '../src';
import { TestBinaryImportWorkerModel } from './mock/worker-model';

const moduleDir = './node_modules';
const packages = ['bcrypt', 'sqlite3'];

test('all binaries are returned', async () => {
  const binaryMatches: IBinaryMatch[][] = [];
  for (const pckg of packages) {
    const matches = scanForBinaryMatches(pckg, [moduleDir]);
    binaryMatches.push(matches);
  }
  expect(binaryMatches.flat().length).toBe(2);
});

test('import and required statements are resolved', () => {
  const processor = WorkerFilePreProcessor
    .fromFile(`${MOCK_DIR}/binary.worker.ts`);

  const importRequire = processor.getImportRequireStatements();
  // console.log(importRequire);
  expect(importRequire.length).toBe(4);
});

test('binary dependencies are being picked up on', () => {
  const processor = WorkerFilePreProcessor
    .fromFile(`${MOCK_DIR}/binary.worker.ts`);

  const importRequire = processor.getImportRequireStatements();
  const binaryDependencies = processor.getNodeBinaryDependency(importRequire);
  expect(binaryDependencies.length).toBe(2);
});

test('binary dependency imports are being swapped out by binary requires', () => {
  const processor = WorkerFilePreProcessor
    .fromFile(`${MOCK_DIR}/binary.worker.ts`);
  
  const resultCode = processor.processBinaryDependencies();
  // console.log('.ts code:\n', resultCode);
  expect(resultCode).toBeDefined();
});

test('binary dependency pre-processing also works on .js', () => {
  const processor = WorkerFilePreProcessor
    .fromFile(`${MOCK_DIR}/binary.worker.js`);
  
  const resultCode = processor.processBinaryDependencies();
  // console.log('.js code:\n', resultCode);
  expect(resultCode).toBeDefined();
});

test('calling a function that depends on a binary', async () => {
  const worker = await NodeOmniWorker
    .build<TestBinaryImportWorkerModel>(`${MOCK_DIR}/binary.worker`);

  console.log(worker);
  const isInitialized = worker.isInitialized();
  expect(isInitialized).toBeTruthy();
});