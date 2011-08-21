/*
 * winston-redis.js: A fixed-length Redis transport for Winston
 *
 * (C) 2011, Charlie Robbins
 *
 */

var redis = require('redis'),
    winston = require('winston'),
    util = require('util');
    
var Redis = exports.Redis = function (options) {
  options       = options || {};
  options.debug = options.debug || false;

  this.name      = 'redis';
  this.redis     = redis.createClient(options.port, options.host);
  this.json      = options.json      || false;
  this.length    = options.length    || 200;
  this.container = options.container || 'winston';
  this.timestamp = options.timestamp || true;
  
  if (options.auth) {
    this.redis.auth(options.auth);
  }
  
  // Suppress errors from the Redis client
  this.redis.on('error', function (err) { 
    console.dir(err);
  });
};  

//
// Define a getter so that `winston.transports.Redis` 
// is available and thus backwards compatible.
//
winston.transports.Redis = Redis;

//
// ### function log (level, msg, [meta], callback)
// Core logging method exposed to Winston. Metadata is optional.
//
Redis.prototype.log = function (level, msg, meta, callback) {
  var self = this;
  
  this.redis.llen(this.container, function (err, len) { 
    if (err) {
      return self.emit('error', err);
    }
    
    //
    // TODO: Observe the json option.
    //
    var output = winston.common.log(level, msg, meta, {
      timestamp: this.timestamp
    });
  
    self.redis.lpush(self.container, output, function (err) {
      if (err) {
        return self.emit('error', err);
      }
      
      self.redis.ltrim(self.container, 0, self.length, function () {
        if (err) {
          return self.emit('error', err);
        }
       
        self.emit('logged');
      });
    });
  });
  
  callback(null, true);
};