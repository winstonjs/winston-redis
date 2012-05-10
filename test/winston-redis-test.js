/*
 * couchdb-test.js: Tests for instances of the Couchdb transport
 *
 * (C) 2011 Max Ogden
 * MIT LICENSE
 *
 */

var path = require('path'),
    vows = require('vows'),
    assert = require('assert'),
    helpers = require('winston/test/helpers'),
    transport = require('winston/test/transports/transport'),
    Redis = require('../lib/winston-redis').Redis;

vows.describe('winston/transports/redis').addBatch({
  'An instance of the Redis Transport': transport(Redis, {
    host: 'localhost',
    port: 6379
  })
}).export(module);
