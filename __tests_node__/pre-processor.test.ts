import { scanForBinaryMatches } from '../src/node/pre-processor/helpers';
import { IBinaryMatch } from '../src/node/pre-processor/model';
import { WorkerFilePreProcessor } from '../src/node/pre-processor/index'
import { MOCK_DIR } from './mock/contstants';

const moduleDir = './node_modules';
const packages = ['bcrypt', 'sqlite3'];

test('test if all binaries are returned', async () => {
  const binaryMatches: IBinaryMatch[][] = [];
  for (const pckg of packages) {
    const matches = scanForBinaryMatches(pckg, [moduleDir]);
    binaryMatches.push(matches);
  }
  expect(binaryMatches.flat().length).toBe(2);
});

test('test if import and required statements are resolved', () => {
  const processor = new WorkerFilePreProcessor(
    `${MOCK_DIR}/binary.worker.ts`
  );

  const importRequire = processor.getImportRequireStatements();
  expect(importRequire.length).toBe(4);
});

test('test if binary dependency is being picked up on', () => {
  const processor = new WorkerFilePreProcessor(
    `${MOCK_DIR}/binary.worker.ts`
  );

  const importRequire = processor.getImportRequireStatements();
  const binaryDependencies = processor.checkForNodeBinaryDependency(importRequire);
  expect(binaryDependencies.length).toBe(2);
});