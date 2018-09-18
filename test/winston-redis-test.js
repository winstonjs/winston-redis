/*
 * winston-redis-test.js: Tests for instances of the Redis transport
 *
 * (C) 2011 Max Ogden
 * MIT LICENSE
 *
 */

const Redis = require('../lib/winston-redis');
const transport = require('winston-transport');

const test_suite = require('abstract-winston-transport');

test_suite({ name: "Redis", Transport: Redis, construct: {
    host: 'localhost',
    port: 6379,
    channel: 'winston-redis-channel-test',
    container: 'winston-redis-test',
    meta: { key: "value" }
  }
});
