// MOST Web Framework Codename Zero Gravity Copyright (c) 2017-2022, THEMOST LP
import { SqliteAdapter } from './SqliteAdapter';
import { SqliteFormatter } from './SqliteFormatter';

/**
 * Creates an instance of SqliteAdapter object that represents a SQLite database connection.
 * @param {*} options An object that represents the properties of the underlying database connection.
 * @returns {*}
 */
function createInstance(options) {
    return new SqliteAdapter(options);
}

export {
    SqliteAdapter,
    SqliteFormatter,
    createInstance
};