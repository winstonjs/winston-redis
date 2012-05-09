# winston-redis

A capped Redis transport for [winston][0].

## Usage
``` js
  var winston = require('winston');
  
  //
  // Requiring `winston-redis` will expose 
  // `winston.transports.Redis`
  //
  require('winston-redis').Redis;
  
  winston.add(winston.transports.Redis, options);
```

This transport accepts the options accepted by the [node-redis][1] client:

* __host:__ (Default **localhost**) Remote host of the Redis server
* __port:__ (Default **6379**) Port the Redis server is running on.
* __auth:__ (Default **None**) Password set on the Redis server

In addition to these, the Redis transport also accepts the following options.

* __length:__ (Default **200**) Number of log messages to store.
* __container:__ (Default **winston**) Name of the Redis container you wish your logs to be in.
* __channel:__ (Default **None**) Name of the Redis channel to stream logs from. 

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
All of the winston tests are written in [vows][2], and designed to be run with npm. 

```
  npm test
```

#### Author: [Charlie Robbins](http://github.com/indexzero)

[0]: https://github.com/indexzero/winston
[1]: https://github.com/mranney/node_redis
[2]: http://vowsjs.org