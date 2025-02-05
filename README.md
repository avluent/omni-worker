# Omni Worker - The Worker for Everything
Webworkers (browser) and thread workers (NodeJS) are usually limiting in their application, since the code that runs on a worker needs to be serializable. Therefore interfaces aren't fully supported, and also 3rd party libraries usually don't work.

Luckily, we now have Omni Workers. These workers allow you to simply declare any interface with functions that will actually run inside a worker. Whether it be on the web (webworker) or as a thread worker in NodeJS, these workers will run your code, no matter what.