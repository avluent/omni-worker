import { describe, test, expect, beforeAll, afterAll, expectTypeOf } from 'vitest';
import { NodeOmniWorker } from '../src/node';
import { NodeOmniWorkerPool } from '../src/node/pool';
import { TestImportWorkerModel, TestWorkerModel } from './mock/worker-model';
import { MOCK_DIR } from './mock/constants';

describe('OmniWorker Pool', () => {

  describe('Launches a new NodeOmniWorkerPool from an existing worker', () => {
    let worker: NodeOmniWorker<TestWorkerModel>;
    let pool: NodeOmniWorkerPool<TestWorkerModel>;

    beforeAll(async () => {
      worker = await NodeOmniWorker
        .build<TestWorkerModel>(`${MOCK_DIR}/worker.ts`);

      pool = NodeOmniWorkerPool
        .launch<TestWorkerModel>(worker, { numOfWorkers: 2 });
    });

    test('The number of instantiated workers is correct', () => {
      const numOfWorkers = pool.getNumOfWorkers();
      expect(numOfWorkers).toBe(2);
    });

    test('Calls from the worker pool are being executed', async () => {
      const result = await pool.use().add(18, 22);
      const result2 = await pool.use().add(48, 32);
      expect(result).toBe(40);
      expect(result2).toBe(80);
    });

    afterAll(async () => {
      await pool.destroy();
    });
  });

  describe('Launches a new NodeOmniWorkerPool from a worker file path', () => {
    let pool: NodeOmniWorkerPool<TestImportWorkerModel>;

    beforeAll(async () => {
      pool = await NodeOmniWorkerPool
        .buildAndLaunch(`${MOCK_DIR}/import.worker.ts`, {
          numOfWorkers: 4
        });
    });

    test('The number of instantiated workers is correct', () => {
      const numOfWorkers = pool.getNumOfWorkers();
      expect(numOfWorkers).toBe(4);
    });

    test('Many function calls are correctly executed on the NodeOmniWorkerPool', async () => {
      const sentence = "i very much like your new tie brother joe";
      const fns: (() => Promise<string>)[] = [];
      for (const word of sentence.split(' ')) {
        const fn = async () => {
          return await pool.use().capitalize(word);
        }
        fns.push(fn);
      }
      
      const result = await Promise.all(fns.map(fn => fn()));

      expect(result).toHaveLength(9);
      expect(result.every(r => /^[A-Z]/.test(r[0]))).toBeTruthy();
    });

    afterAll(async () => {
      await pool.destroy();
    });
  });
});