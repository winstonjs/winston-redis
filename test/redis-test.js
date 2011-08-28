/*
 * redis-test.js: Tests for instances of the Redis transport
 *
 * (C) 2010 Charlie Robbins
 * MIT LICENSE
 *
 */

var path = require('path'),
    vows = require('vows'),
    assert = require('assert'),
    redis = require('redis'),
    winston = require('winston'),
    helpers = require('winston/test/helpers'),
    Redis = require('../lib/winston-redis').Redis;

function assertRedis (transport) {
  assert.instanceOf(transport, Redis);
  assert.isFunction(transport.log);
};

var options = { host: 'localhost', port: 6379, container: 'winston-test' },
    transport = new Redis(options),
    client = redis.createClient(options.port, options.host),
    initial;

vows.describe('winston-redis').addBatch({
 "An instance of the Redis Transport": {
   topic: function () {
     var that = this;
     
     client.llen(options.container, function (err, len) {
       initial = len;
       that.callback();
     });
   },
   "should have the proper methods defined": function () {
     assertRedis(transport);
   },
   "the log() method": helpers.testNpmLevels(transport, "should log messages to redis", function (_, err, result) {
     assert.isTrue(!err);
     assert.isTrue(result);
   })
 }
}).addBatch({
  "When the logging has completed": {
    topic: function () {
      var that = this;
      
      client.llen(options.container, function (err, len) {
        return err 
          ? that.callback(err) 
          : setTimeout(that.callback.bind(that, null, len), 1000);
       });
    },
    "the length should be incremented by the number of levels": function (err, updated) {
      assert.isTrue(updated > initial);
    }
  }
}).export(module);