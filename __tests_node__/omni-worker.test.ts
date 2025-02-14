import { describe, expect, test, beforeEach, afterEach, beforeAll, afterAll } from "vitest";
import { NodeOmniWorker } from '../src/index';
import { TestImportWorkerModel, TestNativeWorkerModel, TestWorkerModel } from './mock/worker-model';

const MOCK_DIR = './__tests_node__/mock';

describe('environment', () => {
  test('we are on nodeJS', () => {
    expect(process).toBeDefined();
  });
});

describe('NodeOmniWorker', () => {

  describe('initializes and calls a NodeOmniWorker', () => {
    let worker: NodeOmniWorker<TestWorkerModel>;


    beforeAll(async () => {
      worker = await NodeOmniWorker
        .build<TestWorkerModel>(`${MOCK_DIR}/worker.ts`);
    });

    test('the NodeOmniWorker is properly initialized', () => {
      const isInitialized = worker.isInitialized();
      expect(isInitialized).toBeTruthy();
    });

    test('the NodeOmniWorker will do a calculation', async () => {
      const result = await worker.use().add(9, 8);
      expect(result).toBe(17);
    });

    afterAll(async () => {
      await worker.destroy();
    });
  });

  describe('initializes and calls an OmniWorker consuming 3rd party imports', () => {
    let worker: NodeOmniWorker<TestImportWorkerModel>;
    
    beforeAll(async () => {
      worker = await NodeOmniWorker
        .build<TestImportWorkerModel>(`${MOCK_DIR}/import.worker.ts`);
    })

    test('the NodeOmniWorker is properly initialized', () => {
      const isInitialized = worker.isInitialized();
      expect(isInitialized).toBeTruthy();
    });

    test('the NodeOmniWorker is used to print: Hello', async () => {
      const result = await worker.use().capitalize("hello");
      expect(result).toBe("Hello");
    })

    afterAll(async () => {
      await worker.destroy();
    });
  });

  describe('initialized and calls an OmniWorker consuming native (.node) imports', () => {
    let worker: NodeOmniWorker<TestNativeWorkerModel>;
    
    beforeAll(async () => {
      worker = await NodeOmniWorker
        .build<TestNativeWorkerModel>(`${MOCK_DIR}/native.worker.ts`);
    });

    test('the NodeOmniWorker is properly initialized', () => {
      const isInitialized = worker.isInitialized();
      expect(isInitialized).toBeTruthy();
    });

    test('the NodeOmniWorker can calculate a Julian Day using Swisseph', async () => {
      const result = await worker.use()
        .swe_julday(2022, 1, 12, 11, 0);
      expect(result).toBe(2459604.9583333335);
    });

    afterAll(async () => {
      await worker.destroy();
    });
  });

}, 7_000);