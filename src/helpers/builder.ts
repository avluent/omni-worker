import path from 'path';

export function getCallerDir() {
  try {
    const stack = new Error().stack!;
    const line = stack.split('\n')[1].trim();
    const segment = line.split(' ')[1];
    const part = segment.split(':')[0];
    const dirName = path.dirname(part);

    return dirName;
  } catch (e) {
    // console.error('building caller path failed', e);
    return './';
  }
}

export const resolveNodeModules = (packageName: string) => 
  require.resolve(packageName,
    {
      paths: [
        path.resolve(__dirname, 'node_modules')
      ]
    });

