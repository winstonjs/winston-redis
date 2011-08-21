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
    winston = require('winston'),
    helpers = require('winston/test/helpers'),
    Redis = require('../lib/winston-redis').Redis;

function assertRedis (transport) {
  assert.instanceOf(transport, Redis);
  assert.isFunction(transport.log);
};

var transport = new Redis();

vows.describe('winston-redis').addBatch({
 "An instance of the Redis Transport": {
   "should have the proper methods defined": function () {
     assertRedis(transport);
   },
   "the log() method": helpers.testNpmLevels(transport, "should log messages to redis", function (ign, err, meta, result) {
     console.dir(arguments);
     assert.isTrue(!err);
     assert.isObject(result);
   })
 }
}).export(module);