/*
 * winston-redis.js: A fixed-length Redis transport for Winston
 *
 * (C) 2011, Charlie Robbins
 *
 */

var redis = require('redis'),
    winston = require('winston'),
    common = require('winston/lib/winston/common'),
    util = require('util'),
    Stream = require('stream').Stream,
    async = require('async');

var Redis = exports.Redis = function (options) {
  winston.Transport.call(this, options);

  var self = this;

  options       = options || {};
  options.host  = options.host || 'localhost';
  options.port  = options.port || 6379;

  this.name      = 'redis';
  this.redis     = options.redis || redis.createClient(options.port, options.host);
  this.json      = options.json !== false;
  this.length    = options.length    || 200;
  this.container = options.container || 'winston';
  this.timestamp = options.timestamp || true;
  this.channel   = options.pchannel || options.channel;
  this.pattern   = options.pattern || !!options.pchannel;
  this.logstash  = options.logstash === true;

  if (options.auth) {
    this.redis.auth(options.auth);
  }

  // Suppress errors from the Redis client
  this.redis.on('error', function (err) {
    self.emit('error');
  });

  if (typeof this.container !== 'function') {
    var container = this.container;
    this.container = function () {
      return container;
    };
  }

  if (this.channel && typeof this.channel !== 'function') {
    var channel = this.channel;
    this.channel = function () {
      return channel;
    };
  }
};

//
// Inherit from `winston.Transport`.
//
util.inherits(Redis, winston.Transport);

//
// Expose the name of this Transport on the prototype
//
Redis.prototype.name = 'redis';

//
// Define a getter so that `winston.transports.Redis`
// is available and thus backwards compatible.
//
winston.transports.Redis = Redis;

//
// ### function log (level, msg, [meta], callback)
// #### @level {string} Level at which to log the message.
// #### @msg {string} Message to log
// #### @meta {Object} **Optional** Additional metadata to attach
// #### @callback {function} Continuation to respond to when complete.
// Core logging method exposed to Winston. Metadata is optional.
//
Redis.prototype.log = function (level, msg, meta, callback) {
  var self = this,
      container = this.container(meta),
      channel = this.channel && this.channel(meta);

  var output = common.log({
    level:       level,
    message:     msg,
    meta:        meta,
    json:        this.json,
    logstash:    this.logstash,
    colorize:    this.colorize,
    prettyPrint: this.prettyPrint,
    timestamp:   this.timestamp,
    showLevel:   this.showLevel,
    stringify:   this.stringify,
    label:       this.label,
    depth:       this.depth,
    formatter:   this.formatter,
    humanReadableUnhandledException: this.humanReadableUnhandledException
  });

  async.series([
    function(cb) {
      self.redis.lpush(container, output, cb);
    },
    function(cb) {
      self.redis.ltrim(container, 0, self.length, cb);
    }
  ], function(err) {
    if (err) {
      if (callback) callback(err, false);
      return self.emit('error', err);
    }

    if (channel) {
      self.redis.publish(channel, output);
    }

    // TODO: emit 'logged' correctly,
    // keep track of pending logs.
    self.emit('logged');

    if (callback) callback(null, true);
  });
};

//
// ### function query (options, callback)
// #### @options {Object} Loggly-like query options for this instance.
// #### @callback {function} Continuation to respond to when complete.
// Query the transport. Options object is optional.
//
Redis.prototype.query = function (options, callback) {
  if (typeof options === 'function') {
    callback = options;
    options = {};
  }

  var options = this.normalizeQuery(options),
      start = options.start || 0,
      end = options.rows + start,
      container = this.container(options);

  this.redis.lrange(container, start, end - 1, function (err, results) {
    if (err) return callback(err);

    results = results.map(function (data) {
      var log, time, obj;

      try {
        log = JSON.parse(data);
      } catch (e) {
        return;
      }

      if (typeof log !== 'object' || !log) return;

      time = new Date(log.timestamp);
      if ((options.from && time < options.from)
         || (options.until && time > options.until)) {
        return;
      }

      if (options.fields) {
        obj = {};
        options.fields.forEach(function (key) {
          obj[key] = log[key];
        });
        log = obj;
      }

      return log;
    }).filter(Boolean);

    if (options.order !== 'desc') {
      results = results.reverse();
    }

    callback(null, results);
  });
};

//
// ### function stream (options)
// #### @options {Object} Stream options for this instance.
// Returns a log stream for this transport. Options object is optional.
// This will use Redis' builtin pubsub capabilities.
// http://redis.io/topics/pubsub
//
Redis.prototype.stream = function (options) {
  var self = this,
      options = options || {},
      stream = new Stream,
      container = this.container(options),
      channel = this.channel(options);

  stream.destroy = function () {
    if (this.destroyed) return;

    this.destroyed = true;

    var i = self.subscription.__channels[channel].indexOf(message);
    if (~i) self.subscription.__channels[channel].splice(i, 1);

    if (!self.subscription.__channels[channel].length) {
      self.subscription.punsubscribe(channel);
      delete self.subscription.__channels[channel];
    }

    if (!Object.keys(self.subscription.__channels).length) {
      try {
        self.subscription.end();
        self.subscription.stream.destroy();
      } catch (e) {
        ;
      }
      delete self.subscription;
    }
  };

  if (!this.subscription) {
    this.subscription = redis.createClient(
      this.redis.options.host,
      this.redis.options.port
    );
    this.subscription.__channels = {};
    this.subscription.on('pmessage', function (pattern, channel, message) {
      var listeners = self.subscription.__channels[pattern];
      if (!listeners) return;
      listeners.forEach(function (listener) {
        listener.call(self.subscription, pattern, channel, message);
      });
    });
  }

  if (!this.subscription.__channels[channel]) {
    this.subscription.psubscribe(channel);
    this.subscription.__channels[channel] = [];
  }

  this.subscription.__channels[channel].push(message);

  function message(pattern, channel, message) {
    if (stream.destroyed) return;

    try {
      message = JSON.parse(message);
    } catch (e) {
      return stream.emit('error',
        new Error('Could not parse: "' + message + '".'));
    }

    stream.emit('log', message);
  }

  if (options.start === -1) {
    delete options.start;
  }

  if (options.start == null) {
    return stream;
  }

  this.redis.lrange(container, options.start, -1, function (err, results) {
    if (stream.destroyed) return;

    if (err) {
      return stream.emit('error', err);
    }

    results.forEach(function (log) {
      try {
        stream.emit('log', JSON.parse(log));
      } catch (e) {
        return stream.emit('error',
          new Error('Could not parse: "' + log + '".'));
      }
    });
  });

  return stream;
};
