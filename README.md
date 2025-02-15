# 👷 Omni Worker - A Versatile Worker for Typescript
Webworkers (browser) and thread workers (NodeJS) are usually limiting in their application, since the code that runs on a worker needs to be serializable. Therefore, most interfaces aren't fully supported, and also 3rd party modules usually don't work or give you a serious headache when implementing them...

Enter the stage, OmniWorkers! These workers allow you to simply declare any interface with functions that will actually run inside a worker. Whether it be on the web (webworker) or on NodeJS (thread worker), these workers will run your code, period.

## How does it Work?
In the case of using typescript for front-end projects, a UI will simply block at certain tasks if they're too heavy. Alternatively, in case of Node, load times can significantly increase since the JavaScript V8 engine only runs one event loop thread. Even when using asynchronous code, the event loop is still just one thread.

### Workers
The [Webworker API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Workers_API) for the web and [Worker Threads](https://nodejs.org/api/worker_threads.html) for NodeJS allow us to declare code inside a seperate file, which will run in its own context (event loop). The advantage of this is that we now have more than one event loop thread to work with. 

The drawback here, is that all code executed inside these (contexed) workers needs to be serializable, since your code is basically shipped into the worker for execution. This is done through the Worker communication interface. Should your code depend on other 3rd party libraries, your code will most-likely not execute, since the code inside the worker context is mostly closed off.

### 👷 OmniWorkers
So how do OmniWorkers stand out from normal workers? First off, their simplicity. Simply declare your code and expose it to the main event loop. Then build the OmniWorker by simply referencing you file. Now, the OmniWorker will expose the object with functions you've injected into the worker container. You can use your own functions with primitive types, functions directly taken from 3rd party modules or a hybrid mix of both. Let's look at an example:

#### `👷‍♀️ workers/worker.ts`
```javascript
import { NodeOmniWorker } from "@anonaddy/omni-worker";

// Interface declared by you
import { IMyOmniWorkerFunctions } from "./worker-model";

// 3rd party module dependency
import { capitalize } from "lodash";

// Declare your functions using an interface
const fnObj: IMyOmniWorkerFunctions = {
  add: (a: number, b: number) => a + b,
  capitalize
}

// In this case, diamond interface can even be omitted, since inferred
NodeOmniWorker.expose<IMyOmniWorkerFunctions>(fnObj);
```
The worker.ts file contains the logic you would like to run inside the container. In our example above we created our own function, but we also included a 3rd party module (lodash) to demonstrate that an OmniWorker can just as well use any other 3rd party module.

What's important, is to expose your logic using the expose function. This will make sure that the container exposes (or shares) your code logic with the main event loop thread, for you to access it in your code.

#### `🏭 index.ts`
```javascript
import { NodeOmniWorker } from "@anonaddy/omni-worker";
import { IMyOmniWorkerFunctions } from "./worker-model";

// Use the static path from your project's root
const WORKER_DIR = "./src/workers";

// Placing anonymous async function on the event loop
setTimeout(async () => {

  // Build the worker from the file you specified and the
  // functions that were exposed
  const worker = await NodeOmniWorker
    .build<IMyOmniWorkerFunctions>(`${WORKER_DIR}/worker.ts`);

  const sum = await worker.use().add(1, 2);
  const str = await worker.use().capitalize("hello");

  console.log(`
    ${str}, my friend!
    The result of my sum is: ${sum}!
    Aren't Omniworkers just awesome?!
  `);

  // Release resources once you're done!
  await worker.destroy();
}, 0);
```
Your code can now just **asynchronously** call the logic you have declared and exposed inside your worker.ts. Simply call the `worker.use()` function and you'll have access to all the functions defined by you inside your `IMyOwnWorkerFunctions` interface. 

> `⚠️ Even if your functions are not returning a Promise in your declaration file, now they will!`

### Worker Pools
Sometimes, having one worker just isn't enough. Worker pools are capable of instantiating multiple workers and consuming their compute power in a round-robin fashion. Let's look at an example:

#### `🏊‍♂️ pool.ts`
```javascript
import { NodeOmniWorkerPool } from '@anonaddy/omni-worker';
import { IMyOmniWorkerFunctions } from "./worker-model";

setTimeout(async () => {

  const pool = await NodeOmniWorkerPool
    .buildAndLaunch<IMyOmniWorkerFunctions>(
      './src/worker/workers/normal.worker.ts',
      { numOfWorkers: 4 }
    );

  const sentence = "i very much like your new tie brother joe";
  const fns: (() => Promise<string>)[] = [];

  // capitalize each word (promisified)
  for (const word of sentence.split(' ')) {
    const fn = async () => {
      return await pool.use().capitalize(word);
    }
    fns.push(fn);
  }
  
  // await all promises and join up the words
  const result = await Promise.all(fns.map(fn => fn()));
  console.log(result.join(' '));
  
  // Release resources once you're done!
  await pool.destroy();

}, 0);

```
The code example above will create a worker pool of 4 workers with the code you specified. All work will be distributed round-robin across the OmniWorkers.

### Under the Hood
This modules leverages [Webpack](https://www.npmjs.com/package/webpack) to parse your container code and build it. From there, it's wired up to the main event loop using a great module called [Comlink](https://github.com/GoogleChromeLabs/comlink). This module abstracts away the communication between the main event loop and Workers.

# Potential Issues
There's cases where building the worker(pool)s could lead to errors. Especially when working with modules that use bindings to other languages such as C or C++. These are usually compiled to native code such as `*.node` binary files using node-gyp. A common error is:
```
❌ Module did not self-register: /path/to/native/binary.node
```
If you're trying to run multiple OmniWorkers (for example inside an OmniWorkerPool) and multiple OmniWorkers depend on the same library (with native .node binary), then this could lead to serious issues. The reason for this, is that multiple contexts are trying to access the same .node file at the same time, which leads to NodeJS not being able to access the file (DLOPEN fails).

If you're absolutely sure that you're only running one OmniWorker and that your OmniWorker depends on native code, but the build still fails, theses are some steps you could try, before trying to start the OmniWorker again:
``` bash
# rebuild the .node native code
npm rebuild <your lib>

# if that didn't work try deleting package info
rm -rf node_modules
mv package-lock.json package-lock.json.backup # make sure to make a backup!
npm i
```
Should you not be able to solve your issue, please drop me an email so we can try and analyze the issue together.

# Project Status
Currently, only `NodeOmniWorker`s and `NodeOmniWorkerPool`s are available. The `WebOmniWorker`s along with their pools will also be available soon. Please stay tuned! In case you have any questions, make sure to drop me an [email](mailto:7ebr7fa0@anonaddy.com) and I will try to get back to you asap.

## Change Log
|Version|Description|
|:-:|-|
|**v0.1.0**|Switched from ESBuild to Webpack for NodeJS and introduced the NodeOmniWorkerPool|
|**v0.0.1**|Basic of single NodeOmniWorker with code having native dependencies still crashing|

### 🏗️ Happy (Omni)Working!! 🏗️