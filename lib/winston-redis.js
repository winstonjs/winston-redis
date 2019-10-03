/*
 * winston-redis.js: A fixed-length Redis transport for Winston
 *
 * (C) 2011, Charlie Robbins
 *
 */

const redis = require('redis');
const Transport = require('winston-transport');
const Stream = require('stream').Stream;
const async = require('async');
const _ = require('lodash');

// TODO REMOVE WHEN FIXED
const { normalizeQuery, formatResults } = require('./transport-patch.js');
Transport.prototype.normalizeQuery = normalizeQuery;
Transport.prototype.formatResults = formatResults;

/**
 * Transport for outputting to a Redis server.
 * @type {Stream}
 * @extends {TransportStream}
 */
class Redis extends Transport {
  constructor(options = {}) {
    super(options);

    this.name      = 'redis';

    if (options.redis instanceof redis.RedisClient) {
      this.redis = options.redis;
    } else if (options.redis instanceof Object) {
      this.redis = redis.createClient(options.redis);
      this.createdClient = true;
    } else {
      options.host  = options.host || 'localhost';
      options.port  = options.port || 6379;
      this.redis = redis.createClient(options.port, options.host);
      this.createdClient = true;
    }

    this.json      = options.json !== false;
    this.length    = options.length || 200;
    this.container = options.container || 'winston';
    this.channel   = options.pchannel || options.channel;
    this.pattern   = options.pattern || !!options.pchannel;
    this.metadata  = options.meta || {};
    this.flatMeta  = options.flatMeta || false;

    if (options.auth) {
      this.redis.auth(options.auth);
    }

    if (this.createdClient) {
      // Suppress errors from the Redis client
      this.redis.on('error', (err) => {
        this.emit('error', err);
      });
    }

    if (typeof this.container !== 'function') {
      var container = this.container;
      this.container = () => {
        return container;
      };
    }

    if (this.channel && typeof this.channel !== 'function') {
      var channel = this.channel;
      this.channel = () => {
        return channel;
      };
    }
  }

  //
  // ### function log (level, msg, [meta], callback)
  // #### @level {string} Level at which to log the message.
  // #### @msg {string} Message to log
  // #### @meta {Object} **Optional** Additional metadata to attach
  // #### @callback {function} Continuation to respond to when complete.
  // Core logging method exposed to Winston. Metadata is optional.
  //
  log(info, callback) {
    const { level, message, ...winstonMeta } = info
    const meta = Object.assign({}, winstonMeta, this.metadata)

    const container = this.container(meta);
    const channel = this.channel && this.channel(meta);

    const output = this.flatMeta
      ? meta[Object.getOwnPropertySymbols(meta).find(s => String(s) === "Symbol(message)")]
      : JSON.stringify({ level, message, meta });

    async.series([
      (cb) => this.redis.lpush(container, output, cb),
      (cb) => this.redis.ltrim(container, 0, this.length, cb)
    ], (err) => {
      if (err) {
        if (callback) callback(err, false);
        return this.emit('error', err);
      }

      if (channel) {
        this.redis.publish(channel, output);
      }

      this.emit('logged', info);

      // Perform the writing to the remote service
      if (callback) callback(null, true);
    });
  }

  //
  // ### function query (options, callback)
  // #### @options {Object} Loggly-like query options for this instance.
  // #### @callback {function} Continuation to respond to when complete.
  // Query the transport. Options object is optional.
  //
  query(options, callback) {
    if (typeof options === 'function') {
      callback = options;
      options = {};
    }

    var options = this.normalizeQuery(options),
        start = options.start || 0,
        end = options.rows + start,
        container = this.container(options);

    this.redis.lrange(container, start, end - 1, (err, results) => {
      if (err) return callback(err);

      results = results.map((data) => {
        var log, time, obj;

        try {
          log = JSON.parse(data);
        } catch (e) {
          return;
        }

        if (typeof log !== 'object' || !log) return;

        time = new Date(log.meta.timestamp);
        if ((options.from && time < options.from)
           || (options.until && time > options.until)) {
          return;
        }

        if (options.fields) {
          obj = {};
          options.fields.forEach((key) => {
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
    })
  }

  //
  // ### function stream (options)
  // #### @options {Object} Stream options for this instance.
  // Returns a log stream for this transport. Options object is optional.
  // This will use Redis' builtin pubsub capabilities.
  // http://redis.io/topics/pubsub
  //
  stream(options) {
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
          self.subscription.end(false);
          self.subscription.stream.destroy();
        } catch (e) {
          ;
        }
        delete self.subscription;
      }
    };

    if (!this.subscription) {
      this.subscription = redis.createClient(this.redis.options);
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
  }

  // Close Connection to redis Server
  close() {
    if (this.redis && this.createdClient)
      this.redis.end(false);
  };
};

module.exports = Redis;
