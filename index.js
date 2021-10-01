// MOST Web Framework 2.0 Codename Blueshift Copyright (c) 2017-2021, THEMOST LP
const { SqliteAdapter } = require('./SqliteAdapter');
const { SqliteFormatter } = require('./SqliteFormatter');

/**
 * Creates an instance of SqliteAdapter object that represents a SQLite database connection.
 * @param {*} options An object that represents the properties of the underlying database connection.
 * @returns {*}
 */
function createInstance(options) {
    return new SqliteAdapter(options);
}

module.exports = {
    SqliteAdapter,
    SqliteFormatter,
    createInstance
};