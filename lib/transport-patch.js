// TODO REMOVE WHEN FIXED
// necessary workarounds for winston 3.0.0-rc1..
exports.normalizeQuery = function (options) {  //
  options = options || {};

  // limit
  options.rows = options.rows || options.limit || 10;

  // starting row offset
  options.start = options.start || 0;

  // now
  options.until = options.until || new Date;
  if (typeof options.until !== 'object') {
    options.until = new Date(options.until);
  }

  // now - 24
  options.from = options.from || (options.until - (24 * 60 * 60 * 1000));
  if (typeof options.from !== 'object') {
    options.from = new Date(options.from);
  }

  // 'asc' or 'desc'
  options.order = options.order || 'desc';

  // which fields to select
  options.fields = options.fields;

  return options;
};

exports.formatResults = function (results, options) {
  return results;
};
