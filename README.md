# 👷 Omni Worker - A Versatile Worker for Typescript
Webworkers (browser) and thread workers (NodeJS) are usually hard to implement, since the code that runs on a worker needs to be serializable and have complex interfaces to transfer the data into the workers. 3rd party modules are usually hard to get working or don't work at all giving you a serious headache when implementing them...

Enter the stage, OmniWorkers! These workers allow you to simply declare an interface with functions (currently with the exception of callbacks) that will actually run inside a worker. Whether it be on the web (webworker) or on NodeJS (thread worker), these workers will run your code inside a worker, period.

## How does it Work?
In the case of using typescript for front-end projects, a UI will simply block at certain tasks if they're too heavy. You could use yielding functions, but that will slow your code down as a result. Similarly, in case of NodeJS, load times can significantly increase since the JavaScript V8 engine only runs one event loop thread. Even when using asynchronous code, the event loop is still just running on one thread.

### Workers
The [Webworker API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Workers_API) for the web and [Worker Threads](https://nodejs.org/api/worker_threads.html) for NodeJS allow us to declare code inside a seperate file, which will run in its own context (event loop). The advantage of this is that we now have more than one event loop thread to work with. 

The drawback here, is that all code executed inside these (contexed) workers needs to be serializable, since your code is basically shipped into the worker for execution. This is done through the Worker communication interface. Should your code depend on other 3rd party libraries, your code would have most-likely not executed, since the code inside the worker context is closed off from the main thread context.

### 👷 OmniWorkers
So what makes OmniWorkers to special? First off, their simplicity. Simply declare your code and expose it to the main event loop. Then build the OmniWorker by simply referencing you file. Now, the OmniWorker will expose the object with functions or a class you've injected into the worker container. You can use your own functions with primitive types, functions directly taken from 3rd party modules or a hybrid mix of both. Let's first look at an example for NodeJS:

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
The worker.ts file contains the logic you would like to run inside the container. In our example above we created our own function inside a object containing functions, but notice how we included a 3rd party module (lodash). This demonstrates that an OmniWorker can just as well use any other 3rd party module as well as logic defined by you.

What's important, is to expose your logic using the expose function. This will make sure that the container exposes (or shares) your code logic with the main event loop, for you to access it in the rest of your code:

#### `🏭 index.ts`
```javascript
import { NodeOmniWorker } from "@anonaddy/omni-worker";
import { IMyOmniWorkerFunctions } from "./worker-model";

// Use the static path from your project's root
const WORKER_DIR = "./src/workers";

// Placing anonymous async function on the event loop
(async () => {

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
})();
```
Your code can now just **asynchronously** call the logic you have declared and exposed inside your worker.ts. Simply call the `worker.use()` function and you'll have access to all the functions defined by you inside your `IMyOwnWorkerFunctions` interface. 

> `⚠️ Even if your functions are not returning a Promise in your declaration file, now they will!`

### Worker Pools
Sometimes, having one worker just isn't enough. Worker pools are capable of instantiating multiple workers and consuming their compute power in a round-robin fashion. Let's look at an example:

#### `🏊‍♂️ pool.ts`
```javascript
import { NodeOmniWorkerPool } from '@anonaddy/omni-worker';
import { IMyOmniWorkerFunctions } from "./worker-model";

(async () => {

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

})();

```
The code example above will create a worker pool of 4 workers with the code you specified. All work will be distributed round-robin across the OmniWorkers. We recommend using as many workers inside the pool as you have threads on the processor running the code. This will make sure that performance is optimal. Too many workers can AND WILL degrade performance in JavaScript.

### 🕸️ WebOmniWorkers
When you're building a module for the web, you can't use Node's module resolution. Instead, you will use a bundler (e.g. Webpack, Rollup) to bundle your code, usually in a format like ESM. This use case is covered by WebOmniWorkers.

The only difference when instantiating a WebOmniWorker is that instead of a project file path, a URL object needs to be parsed into the build function. Also, when using any 3rd party modules, these need to be statically linked inside your `worker.ts` file and can't be linked using Node's module resolution.

Please see the [demos](https://github.com/avluent/omni-worker-demos) project to see how a WebOmniWorker(pool) can be instantiated on a JavaScript module project.

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
Should you not be able to solve your issue, please drop me an email so we can have a look at your case. We're constantly attempt at improving compatitiblity for these types of use cases. Should you have an idea of you own, also feel free to provide a pull request. 

# Project Status
We're happy to announce that `WebOmniWorker`s along with their pools are now available. In case you have any questions, make sure to drop me an [email](mailto:7ebr7fa0@anonaddy.com) and I will get back to you asap.

## Change Log
|Version|Description|
|:-:|-|
|**v0.2.0**|Introduced the WebOmniWorker and the WebOmniWorker pool. Split the project for Node and Web|
|**v0.1.0**|Switched from ESBuild to Webpack for NodeJS and introduced the NodeOmniWorkerPool|
|**v0.0.1**|Basic of single NodeOmniWorker with code having native dependencies still crashing|

### 🏗️ Happy (Omni)Working!! 🏗️