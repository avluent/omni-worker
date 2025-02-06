# 👷 Omni Worker - A Versatile Worker for Typescript
Webworkers (browser) and thread workers (NodeJS) are usually limiting in their application, since the code that runs on a worker needs to be serializable. Therefore interfaces aren't fully supported, and also 3rd party libraries usually don't work.

Enter the stage, OmniWorkers! These workers allow you to simply declare any interface with functions that will actually run inside a worker. Whether it be on the web (webworker) or as a thread worker in NodeJS, these workers will run your code, no matter what.

## How does it Work?
In the case of jsDOM, the UI will block at certain tasks if it's too heavy. Alternatively, in case of Node, load times will take longer since the JavaScript V8 engine only runs one event loop thread. Even when using asynchronous code, the event loop can easily get overloaded.

### Workers
The [Webworker API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Workers_API) for the web and [Worker Threads](https://nodejs.org/api/worker_threads.html) for NodeJS allow us to declare code inside a seperate file, which will run in its own context. The advantage, is that we now have more than one event loop thread to work on. The drawback of course, is that all code executed inside these (contexed) workers needs to be serializable, since your code is basically shipped into the worker for execution. If you have code that depends on other 3rd party libraries, your code will most-likely not build, since the code inside the worker context is closed off.

### 👷 OmniWorkers
So how do OmniWorkers stand out from normal workers? First off, the simplicity. Simply declare your code and expose it to the main event loop. Then, build the OmniWorker by referencing you file. Now, the OmniWorker will expose the object with functions you've injected into the worker container. You can use your own functions with primitive types, functions directly taken from 3rd party modules or a hybrid mix of both. Let's look at an example:

#### `👷‍♀️ workers/worker.ts`
```javascript
import { NodeOmniWorker } from "omni-worker";
import { IMyOmniWorkerFunctions } from "./worker-model";
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
import { NodeOmniWorker } from "omni-worker";
import { IMyOmniWorkerFunctions } from "./worker-model";

const WORKER_DIR = "./workers";

// Build the worker from the file you specified and the
// functions that were exposed
const worker = await NodeOmniWorker
  .build<IMyOmniWorkerFunctions>(`${WORKER_DIR}/worker`);

// Placing anonymous async function on the event loop
setTimeout(async () => {
  const sum = await worker.use().add(1, 2);
  const str = await worker.use().capitalize("hello");

  console.log(`
    ${str}, my friend!
    The result of my sum is: ${sum}!
    Aren't Omniworkers just awesome?!
  `);
}, 0);
```
Your code can now just asynchronously call the logic you have declared and exposed inside your worker. Simply call the `worker.use()` function and you'll have access to all the functions defined by you inside your `IMyOwnWorkerFunctions` interface.

### Under the Hood
This modules leverages [Comlink](https://github.com/GoogleChromeLabs/comlink) and [Esbuild](https://github.com/evanw/esbuild) to parse your container code, build it and wire it up to the main event loop using Comlink. Many thanks to all maintainers of both these modules.

# Project Status
Currently, only `NodeOmniWorker`s are available. The `WebOmniWorker`s will also be available soon. Please stay tuned! In case you have any questions, make sure to drop me an [email](mailto:7ebr7fa0@anonaddy.com) and I will try to get back to you asap.

## Tests
Tests are included inside this library. If you would like to learn how to build and instantiate your workers, you can find examples inside the test code, for node inside `__tests_node__` and for web `__tests_dom__` respectively.

**Happy (Omni)Working!!**