import { NodeOmniWorker } from '../src/node/index';
import { TestImportWorkerModel, TestWorkerModel } from './mock/worker-model';
import { MOCK_DIR } from './mock/contstants';

test('Node test: process should be defined', () => {
  expect(process).toBeDefined();
});

test('initializes and calls a NodeOmniWorker', async () => {
  const worker = await NodeOmniWorker
    .build<TestWorkerModel>(`${MOCK_DIR}/worker`);

  const isInitialized = worker.isInitialized();
  expect(isInitialized).toBeTruthy();

  const result = await worker.use().add(9, 8);
  expect(result).toBe(17);
});

test('initializes and calls an OmniWorker consuming 3rd party imports', async () => {
  const worker = await NodeOmniWorker
    .build<TestImportWorkerModel>(`${MOCK_DIR}/import.worker`);

  const isInitialized = worker.isInitialized();
  expect(isInitialized).toBeTruthy();

  const result = await worker.use().capitalize("hello");
  expect(result).toBe("Hello");
});
