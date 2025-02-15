import { describe, test, expect, beforeAll, afterAll } from 'vitest';
import { NodeOmniWorkerPool } from '../src/node/pool';
import { TestImportWorkerModel } from './mock/worker-model';
import { MOCK_DIR } from './mock/constants';

describe('OmniWorker Pool', () => {

  describe('Launches a new NodeOmniWorkerPool from a worker file path', () => {
    let pool: NodeOmniWorkerPool<TestImportWorkerModel>;

    beforeAll(async () => {
      pool = await NodeOmniWorkerPool
        .buildAndLaunch(`${MOCK_DIR}/import.worker.ts`, {
          numOfWorkers: 4,
          freshCode: true
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
}, 10_000);