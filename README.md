# winston-redis

A capped Redis transport for [winston][0].

## Requirements

- NodeJS 8.11.x
- Winston 3.x

## Usage
``` js
  const winston = require('winston');
  const redisTransport = require('winston-redis');

  const logger = winston.createLogger({
    level: 'info',
    transports: [
      new redisTransport()
    ]
  });

  logger.log({
    level: "info",
    message: "redis is awesome",
    reason: "it's fast" // this will get stored as meta data
  });
```

This transport accepts the options accepted by the [node-redis][1] client:

* __host:__ (Default **localhost**) Remote host of the Redis server
* __port:__ (Default **6379**) Port the Redis server is running on.
* __auth:__ (Default **None**) Password set on the Redis server

In addition to these, the Redis transport also accepts the following options.

* __redis:__ Either the redis client or the options for the redis client
* __length:__ (Default **200**) Number of log messages to store.
* __container:__ (Default **winston**) Name of the Redis container you wish your logs to be in.
* __channel:__ (Default **None**) Name of the Redis channel to stream logs from.
* __meta:__ (Default **{}**) Custom fields to add to each log.

*Metadata:* Logged as JSON literal in Redis

## Installation

### Installing npm (node package manager)

``` bash
  $ curl http://npmjs.org/install.sh | sh
```

### Installing winston-redis

``` bash
  $ npm install winston
  $ npm install winston-redis
```

## Run Tests
Winston-redis tests are written in [mocha][2], using [Abstract Winston Transport][3] and designed to be run with npm. 

```
  npm test
```

#### Author: [Charlie Robbins](http://github.com/indexzero)

[0]: https://github.com/winstonjs/winston
[1]: https://github.com/mranney/node_redis
[2]: https://mochajs.org
[3]: https://github.com/winstonjs/abstract-winston-transport
