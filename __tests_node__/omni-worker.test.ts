import { describe, expect, test, beforeEach, afterEach } from "vitest";
import { NodeOmniWorker } from '../src/index';
import { TestImportWorkerModel, TestNativeWorkerModel, TestWorkerModel } from './mock/worker-model';

const MOCK_DIR = './__tests_node__/mock';

describe('Regular NodeOmniWorker', () => {

  test('Node test: process should be defined', () => {
    expect(process).toBeDefined();
  });

  test('initializes and calls a NodeOmniWorker', async () => {
    const worker = await NodeOmniWorker
      .build<TestWorkerModel>(`${MOCK_DIR}/worker.ts`);

    beforeEach(async () => {
      const isInitialized = worker.isInitialized();
      expect(isInitialized).toBeTruthy();

      const result = await worker.use().add(9, 8);
      expect(result).toBe(17);
    });

    afterEach(async () => {
      await worker.destroy();
    });
  });

  test('initializes and calls an OmniWorker consuming 3rd party imports', async () => {
    const worker = await NodeOmniWorker
      .build<TestImportWorkerModel>(`${MOCK_DIR}/import.worker.ts`);

    beforeEach(async () => {
      const isInitialized = worker.isInitialized();
      expect(isInitialized).toBeTruthy();

      const result = await worker.use().capitalize("hello");
      expect(result).toBe("Hello");
    });

    afterEach(async () => {
      await worker.destroy();
    });
  });

  test('initialized and calls an OmniWorker consuming native (.node) imports', async () => {
    const worker = await NodeOmniWorker
      .build<TestNativeWorkerModel>(`${MOCK_DIR}/native.worker.ts`);

    beforeEach(async () => {
      const isInitialized = worker.isInitialized();
      expect(isInitialized).toBeTruthy();

      const result = await worker.use()
        .swe_julday(2022, 1, 12, 11, 0);

      expect(result).toBe("number");
    });

    afterEach(async () => {
      await worker.destroy();
    });
  });

}, 60_000);