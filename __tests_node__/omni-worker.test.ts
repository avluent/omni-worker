import { NodeOmniWorker } from '../src/index';
import { TestImportWorkerModel, TestWorkerModel } from './mock/worker-model';

const MOCK_DIR = './__tests_node__/mock';

test('Node test: process should be defined', () => {
  expect(process).toBeDefined();
});

test('initializes and calls a NodeOmniWorker', async () => {
  const worker = await NodeOmniWorker
    .build<TestWorkerModel>(`${MOCK_DIR}/worker.ts`);

  const isInitialized = worker.isInitialized();
  expect(isInitialized).toBeTruthy();

  const result = await worker.use().add(9, 8);
  expect(result).toBe(17);
});

test('initializes and calls an OmniWorker consuming 3rd party imports', async () => {
  const worker = await NodeOmniWorker
    .build<TestImportWorkerModel>(`${MOCK_DIR}/import.worker.ts`);

  const isInitialized = worker.isInitialized();
  expect(isInitialized).toBeTruthy();

  const result = await worker.use().capitalize("hello");
  expect(result).toBe("Hello");
});
