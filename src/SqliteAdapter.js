// MOST Web Framework Codename Zero Gravity Copyright (c) 2017-2022, THEMOST LP

import { sprintf } from 'sprintf-js';
import {waterfall, eachSeries} from 'async';
import {TraceUtils}  from '@themost/common';
import { QueryExpression, QueryField, SqlUtils } from '@themost/query';
import { SqliteFormatter } from './SqliteFormatter';
import sqlite from 'sqlite3';
const sqlite3 = sqlite.verbose();
const SqlDateRegEx = /^\d{4}-\d{2}-\d{2}\s\d{2}:\d{2}:\d{2}\.\d+\+[0-1][0-9]:[0-5][0-9]$/;

/* eslint-disable no-unused-vars */
// noinspection JSUnusedLocalSymbols
const SQLITE_OPEN_READONLY = 0x00000001;  /* Ok for sqlite3_open_v2() */
const SQLITE_OPEN_READWRITE = 0x00000002;  /* Ok for sqlite3_open_v2() */
const SQLITE_OPEN_CREATE = 0x00000004;  /* Ok for sqlite3_open_v2() */
// noinspection JSUnusedLocalSymbols
const SQLITE_OPEN_NOMUTEX = 0x00008000; /* Ok for sqlite3_open_v2() */
// noinspection JSUnusedLocalSymbols
const SQLITE_OPEN_FULLMUTEX = 0x00010000;  /* Ok for sqlite3_open_v2() */
// noinspection JSUnusedLocalSymbols
const SQLITE_OPEN_SHAREDCACHE = 0x00020000;  /* Ok for sqlite3_open_v2() */
// noinspection JSUnusedLocalSymbols
const SQLITE_OPEN_PRIVATECACHE = 0x00040000;  /* Ok for sqlite3_open_v2() */
/* eslint-enable no-unused-vars */


class SqliteAdapter {
    /**
     * @param {*} options
     */
    constructor(options) {
        /**
         * @type {{database: string,retry: number=,retryInterval: number=}}
         */
        this.options = options || { database: ':memory:' };
        // set defaults
        if (typeof this.options.retry === 'undefined') {
            this.options.retry = 4;
            this.options.retryInterval = 1000;
        }
        /**
         * Represents the database raw connection associated with this adapter
         * @type {*}
         */
        this.rawConnection = null;
    }
    open(callback) {
        const self = this;
        callback = callback || function () { };
        if (self.rawConnection) {
            callback();
        }
        else {
            //try to open or create database
            self.rawConnection = new sqlite3.Database(self.options.database, SQLITE_OPEN_READWRITE + SQLITE_OPEN_CREATE + SQLITE_OPEN_FULLMUTEX, function (err) {
                if (err) {
                    self.rawConnection = null;
                }
                callback(err);
            });
        }
    }

    /**
     * Opens a database connection
     */
    openAsync() {
        return new Promise((resolve, reject) => {
            return this.open( err => {
                if (err) {
                    return reject(err);
                }
                return resolve();
            });
        });
    }

    close(callback) {
        const self = this;
        callback = callback || function () { };
        try {
            if (self.rawConnection) {
                //close connection
                self.rawConnection.close(function () {
                    // clear rawConnection
                    self.rawConnection = null;
                    //and finally return
                    callback();
                });
            }
            else {
                callback();
            }
        }
        catch (err) {
            TraceUtils.log('An error occurred while closing database.');
            TraceUtils.log(err);
            //call callback without error
            callback();
        }
    }
    /**
     * Closes the current database connection
     */
    closeAsync() {
        return new Promise((resolve, reject) => {
            return this.close( err => {
                if (err) {
                    return reject(err);
                }
                return resolve();
            });
        });
    }
    /**
     * @param {string} query
     * @param {*=} values
     */
    prepare(query, values) {
        return SqlUtils.format(query, values);
    }
    formatType(field) {
        const size = parseInt(field.size);
        let s;
        switch (field.type) {
            case 'Boolean':
                s = 'INTEGER(1,0)';
                break;
            case 'Byte':
                s = 'INTEGER(1,0)';
                break;
            case 'Number':
            case 'Float':
                s = 'REAL';
                break;
            case 'Counter':
                return 'INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL';
            case 'Currency':
                s = 'NUMERIC(' + (field.size || 19) + ',4)';
                break;
            case 'Decimal':
                s = 'NUMERIC';
                if ((field.size) && (field.scale)) {
                    s += '(' + field.size + ',' + field.scale + ')';
                }
                break;
            case 'Date':
            case 'DateTime':
                s = 'NUMERIC';
                break;
            case 'Time':
                s = size > 0 ? sprintf('TEXT(%s,0)', size) : 'TEXT';
                break;
            case 'Long':
                s = 'NUMERIC';
                break;
            case 'Duration':
                s = size > 0 ? sprintf('TEXT(%s,0)', size) : 'TEXT(48,0)';
                break;
            case 'Integer':
                s = 'INTEGER' + (field.size ? '(' + field.size + ',0)' : '');
                break;
            case 'URL':
            case 'Text':
            case 'Note':
                s = field.size ? sprintf('TEXT(%s,0)', field.size) : 'TEXT';
                break;
            case 'Image':
            case 'Binary':
                s = 'BLOB';
                break;
            case 'Guid':
                s = 'TEXT(36,0)';
                break;
            case 'Short':
                s = 'INTEGER(2,0)';
                break;
            case 'Json':
                s = 'JSON HIDDEN';
                break;
            default:
                s = 'INTEGER';
                break;
        }
        if (field.primary) {
            return s.concat(' PRIMARY KEY NOT NULL');
        }
        else {
            return s.concat((field.nullable === undefined) ? ' NULL' : (field.nullable ? ' NULL' : ' NOT NULL'));
        }
    }
    format(format, obj) {
        let result = format;
        if (/%t/.test(format))
            result = result.replace(/%t/g, this.formatType(obj));
        if (/%f/.test(format))
            result = result.replace(/%f/g, obj.name);
        return result;
    }
    /**
     * Begins a transactional operation by executing the given function
     * @param fn {function} The function to execute
     * @param callback {function(Error=)} The callback that contains the error -if any- and the results of the given operation
     */
    executeInTransaction(fn, callback) {
        const self = this;
        //ensure parameters
        fn = fn || function () { };
        callback = callback || function () { };
        self.open(function (err) {
            if (err) {
                callback(err);
            }
            else {
                if (self.transaction) {
                    fn.call(self, function (err) {
                        callback(err);
                    });
                }
                else {
                    // set transaction mode before begin
                    self.transaction = true;
                    //begin transaction
                    self.rawConnection.run('BEGIN TRANSACTION;', undefined, function (err) {
                        if (err) {
                            // reset transaction mode
                            delete self.transaction;
                            return callback(err);
                        }
                        try {
                            // invoke method
                            fn(function (err) {
                                if (err) {
                                    // rollback transaction
                                    return self.rawConnection.run('ROLLBACK;', undefined, function () {
                                        // reset transaction mode on error
                                        delete self.transaction;
                                        return callback(err);
                                    });
                                }
                                // commit transaction
                                self.rawConnection.run('COMMIT;', undefined, function (err) {
                                    // reset transaction mode on error
                                    delete self.transaction;
                                    return callback(err);
                                });
                            });
                        } catch (invokeError) {
                            return self.rawConnection.run('ROLLBACK;', undefined, function () {
                                // reset transaction mode on error
                                delete self.transaction;
                                return callback(invokeError);
                            });
                        }
                    });
                }
            }
        });
    }

    /**
     * Begins a data transaction and executes the given function
     * @param func {Function}
     */
    executeInTransactionAsync(func) {
        return new Promise((resolve, reject) => {
            return this.executeInTransaction((callback) => {
                return func.call(this).then( res => {
                    return callback(null, res);
                }).catch( err => {
                    return callback(err);
                });
            }, (err, res) => {
                if (err) {
                    return reject(err);
                }
                return resolve(res);
            });
        });
    }

    /**
     *
     * @param {string} name
     * @param {QueryExpression|*} query
     * @param {function(Error=)} callback
     */
    createView(name, query, callback) {
        this.view(name).create(query, callback);
    }
    /*
     * @param {DataAdapterMigration} obj An Object that represents the data model scheme we want to migrate
     * @param {function(Error=)} callback
     */
    migrate(obj, callback) {
        const self = this;
        callback = callback || function () { };
        if (obj == null) {
            return callback();
        }
        /**
         * @type {*}
         */
        const migration = obj;
        // create a copy of columns
        const addColumns = migration.add.slice(0);
        const format = function (format, obj) {
            let result = format;
            if (/%t/.test(format))
                result = result.replace(/%t/g, self.formatType(obj));
            if (/%f/.test(format))
                result = result.replace(/%f/g, obj.name);
            return result;
        };
        waterfall([
            //1. Check migrations table existence
            function (cb) {
                void self.table('migrations').exists(function (err, exists) {
                    if (err) {
                        return cb(err);
                    }
                    return cb(null, exists);
                });
            },
            //2. Create migrations table, if it does not exist
            function (arg, cb) {
                if (arg) {
                    return cb(null, 0);
                }
                //create migrations table
                void self.execute('CREATE TABLE migrations("id" INTEGER PRIMARY KEY AUTOINCREMENT, ' +
                    '"appliesTo" TEXT NOT NULL, "model" TEXT NULL, "description" TEXT,"version" TEXT NOT NULL)', [], function (err) {
                    if (err) {
                        return cb(err);
                    }
                    return cb(null, 0);
                });
            },
            //3. Check if migration has already been applied (true=Table version is equal to migration version, false=Table version is older from migration version)
            function (arg, cb) {
                void self.table(migration.appliesTo).version(function (err, version) {
                    if (err) {
                        return cb(err);
                    }
                    return cb(null, (version >= migration.version));
                });
            },
            //4a. Check table existence (-1=Migration has already been applied, 0=Table does not exist, 1=Table exists)
            function (arg, cb) {
                //migration has already been applied (set migration.updated=true)
                if (arg) {
                    migration.updated = true;
                    return cb(null, -1);
                }
                else {
                    void self.table(migration.appliesTo).exists(function (err, exists) {
                        if (err) {
                            return cb(err);
                        }
                        return cb(null, exists ? 1 : 0);
                    });
                }
            },
            //4. Get table columns
            function (arg, cb) {
                //migration has already been applied
                if (arg < 0) {
                    return cb(null, [arg, null]);
                }
                void self.table(migration.appliesTo).columns(function (err, columns) {
                    if (err) {
                        return cb(err);
                    }
                    return cb(null, [arg, columns]);
                });
            },
            //5. Migrate target table (create or alter)
            function (args, cb) {
                //migration has already been applied (args[0]=-1)
                if (args[0] < 0) {
                    return cb(null, args[0]);
                }
                else if (args[0] === 0) {
                    //create table
                    const strFields = migration.add.filter(function (x) {
                        return !x['oneToMany'];
                    }).map(function (x) {
                        return format('"%f" %t', x);
                    }).join(', ');
                    const sql = sprintf('CREATE TABLE "%s" (%s)', migration.appliesTo, strFields);
                    self.execute(sql, null, function (err) {
                        if (err) {
                            cb(err);
                            return;
                        }
                        cb(null, 1);
                    });
                }
                else if (args[0] === 1) {
                    const expressions = [];
                    const /**
                     * @type {{name: string,columnName:string,ordinal:number,dataType:*, maxLength:number,isNullable:number,primary:boolean }[]}
                     */ columns = args[1];
                    let forceAlter = false;
                    let column;
                    let newType;
                    let oldType;
                    //validate operations
                    //1. columns to be removed
                    if (Array.isArray(migration.remove)) {
                        if (migration.remove > 0) {
                            for (let i = 0; i < migration.remove.length; i++) {
                                let x = migration.remove[i];
                                let colIndex = columns.findIndex((y) => {
                                    return y.name === x.name;
                                });
                                if (colIndex >= 0) {
                                    if (!columns[colIndex].primary) {
                                        forceAlter = true;
                                    }
                                    else {
                                        migration.remove.splice(i, 1);
                                        i -= 1;
                                    }
                                }
                                else {
                                    migration.remove.splice(i, 1);
                                    i -= 1;
                                }
                            }
                        }
                    }
                    //1. columns to be changed
                    if (Array.isArray(migration.change)) {
                        if (migration.change > 0) {
                            for (let i = 0; i < migration.change.length; i++) {
                                let x = migration.change[i];
                                column = columns.find((y) => {
                                    return y.name === x.name;
                                });
                                if (column) {
                                    if (!column.primary) {
                                        //validate new column type (e.g. TEXT(120,0) NOT NULL)
                                        newType = format('%t', x);
                                        oldType = column.type.toUpperCase().concat(column.nullable ? ' NOT NULL' : ' NULL');
                                        if ((newType !== oldType)) {
                                            //force alter
                                            forceAlter = true;
                                        }
                                    }
                                    else {
                                        //remove column from change collection (because it's a primary key)
                                        migration.change.splice(i, 1);
                                        i -= 1;
                                    }
                                }
                                else {
                                    //add column (column was not found in table)
                                    migration.add.push(x);
                                    //remove column from change collection
                                    migration.change.splice(i, 1);
                                    i -= 1;
                                }
                            }
                        }
                    }
                    if (Array.isArray(migration.add)) {

                        // find removed columns
                        for (const column of columns) {
                            const found = addColumns.find((x) => x.name === column.name);
                            if (found == null) {
                                forceAlter = true;
                            }
                        }
                        if (forceAlter === false) {
                            for (let i = 0; i < migration.add.length; i++) {
                                let x = migration.add[i];
                                column = columns.find((y) => {
                                    return (y.name === x.name);
                                });
                                if (column) {
                                    if (column.primary) {
                                        migration.add.splice(i, 1);
                                        i -= 1;
                                    }
                                    else {
                                        newType = format('%t', x);
                                        oldType = column.type.toUpperCase().concat(column.nullable ? ' NULL' : ' NOT NULL');
                                        // trim zero scale for both new and old type
                                        // e.g. TEXT(50,0) to TEXT(50)
                                        const reTrimScale = /^(NUMERIC|TEXT|INTEGER)\((\d+)(,0)\)/g;
                                        if (reTrimScale.test(newType) === true) {
                                            // trim
                                            newType = newType.replace(reTrimScale, '$1($2)');
                                        }
                                        if (reTrimScale.test(oldType) === true) {
                                            // trim
                                            oldType = oldType.replace(reTrimScale, '$1($2)');
                                        }
                                        if (newType === oldType) {
                                            //remove column from add collection
                                            migration.add.splice(i, 1);
                                            i -= 1;
                                        }
                                        else {
                                            forceAlter = true;
                                        }
                                    }
                                } else {
                                    forceAlter = true;
                                }
                            }
                        }
                        if (forceAlter) {
                            // eslint-disable-next-line no-unexpected-multiline
                            return (async function() {
                                // prepare to rename existing table and create a new one
                                const renamed = '__' + migration.appliesTo + '_' + new Date().getTime().toString() + '__';
                                const formatter = new SqliteFormatter();
                                const renameTable = formatter.escapeName(renamed);
                                const table = formatter.escapeName(migration.appliesTo);
                                const existingFields = await self.table(migration.appliesTo).columnsAsync();
                                // get indexes
                                const indexes = await self.indexes(migration.appliesTo).listAsync();
                                for (const index of indexes) {
                                    await self.indexes(migration.appliesTo).dropAsync(index.name);
                                }
                                // rename table
                                await self.executeAsync(`ALTER TABLE ${table} RENAME TO ${renameTable}`, []);
                                // format field collection
                                let fields = addColumns.filter((x) => {
                                    return !x.oneToMany;
                                }).map((x) => {
                                    return format('"%f" %t', x);
                                }).join(', ');
                                let sql = `CREATE TABLE ${table} (${fields})`;
                                // create table
                                await self.executeAsync(sql, []);
                                // get source fields
                                const newFields = await self.table(migration.appliesTo).columnsAsync();
                                const insertFields = [];
                                for (const existingField of existingFields) {
                                    const insertField = newFields.find((x) => x.name === existingField.name);
                                    if (insertField != null) {
                                        insertFields.push(insertField);
                                    }
                                }
                                if (insertFields.length === 0) {
                                    throw new Error('Table migration cannot be completed because the collection of fields is empty.');
                                }
                                fields = insertFields.map((x) => formatter.escapeName(x.name)).join(', ');
                                sql = `INSERT INTO ${table}(${fields}) SELECT ${fields} FROM ${renameTable}`;
                                // insert data
                                await self.executeAsync(sql, []);
                            })().then(() => {
                                return cb(null, 1);
                            }).catch((error) => {
                                return cb(error);
                            });
                        }
                        else {
                            const formatter = new SqliteFormatter();
                            migration.add.forEach(function (x) {
                                //search for columns
                                expressions.push(sprintf('ALTER TABLE %s ADD COLUMN %s %s', formatter.escapeName(migration.appliesTo), formatter.escapeName(x.name), self.formatType(x)));
                            });
                        }
                    }
                    if (expressions.length > 0) {
                        eachSeries(expressions, function (expr, cb) {
                            self.execute(expr, [], function (err) {
                                cb(err);
                            });
                        }, function (err) {
                            if (err) {
                                cb(err);
                                return;
                            }
                            cb(null, 1);
                        });
                    }
                    else {
                        cb(null, 2);
                    }
                }
                else {
                    cb(new Error('Invalid table status.'));
                }
            },
            //Apply data model indexes
            function (arg, cb) {
                if (arg <= 0) {
                    return cb(null, arg);
                }
                if (migration.indexes) {
                    const tableIndexes = self.indexes(migration.appliesTo);
                    //enumerate migration constraints
                    eachSeries(migration.indexes, function (index, indexCallback) {
                        tableIndexes.create(index.name, index.columns, indexCallback);
                    }, function (err) {
                        //throw error
                        if (err) {
                            return cb(err);
                        }
                        //or return success flag
                        return cb(null, 1);
                    });
                }
                else {
                    //do nothing and exit
                    return cb(null, 1);
                }
            },
            function (arg, cb) {
                if (arg > 0) {
                    //log migration to database
                    self.execute('INSERT INTO migrations("appliesTo", "model", "version", "description") VALUES (?,?,?,?)', [migration.appliesTo,
                    migration.model,
                    migration.version,
                    migration.description], function (err) {
                        if (err) {
                            return cb(err);
                        }
                        cb(null, 1);
                    });
                }
                else {
                    migration.updated = true;
                    cb(null, arg);
                }
            }
        ], function (err) {
            callback(err);
        });
    }
    /**
     * 
     * @param {*} obj
     * @returns {*}
     */
    migrateAsync(obj) {
        return new Promise((resolve, reject) => {
            this.migrate(obj, (err, res) => {
                if (err) {
                    return reject(err);
                }
                return resolve(res);
            });
        });
    }
    /**
     * Produces a new identity value for the given entity and attribute.
     * @param entity {String} The target entity name
     * @param attribute {String} The target attribute
     * @param callback {Function=}
     */
    selectIdentity(entity, attribute, callback) {
        const self = this;
        const migration = {
            appliesTo: 'increment_id',
            model: 'increments',
            description: 'Increments migration (version 1.0)',
            version: '1.0',
            add: [
                { name: 'id', type: 'Counter', primary: true },
                { name: 'entity', type: 'Text', size: 120 },
                { name: 'attribute', type: 'Text', size: 120 },
                { name: 'value', type: 'Integer' }
            ]
        };
        //ensure increments entity
        self.migrate(migration, function (err) {
            //throw error if any
            if (err) {
                callback.call(self, err);
                return;
            }
            self.execute('SELECT * FROM increment_id WHERE entity=? AND attribute=?', [entity, attribute], function (err, result) {
                if (err) {
                    callback.call(self, err);
                    return;
                }
                if (result.length === 0) {
                    //get max value by querying the given entity
                    const q = new QueryExpression().from(entity).select([new QueryField().max(attribute)]);
                    self.execute(q, null, function (err, result) {
                        if (err) {
                            callback.call(self, err);
                            return;
                        }
                        let value = 1;
                        if (result.length > 0) {
                            value = (parseInt(result[0][attribute]) || 0) + 1;
                        }
                        self.execute('INSERT INTO increment_id(entity, attribute, value) VALUES (?,?,?)', [entity, attribute, value], function (err) {
                            //throw error if any
                            if (err) {
                                callback.call(self, err);
                                return;
                            }
                            //return new increment value
                            callback.call(self, err, value);
                        });
                    });
                }
                else {
                    //get new increment value
                    const value = parseInt(result[0].value) + 1;
                    self.execute('UPDATE increment_id SET value=? WHERE id=?', [value, result[0].id], function (err) {
                        //throw error if any
                        if (err) {
                            callback.call(self, err);
                            return;
                        }
                        //return new increment value
                        callback.call(self, err, value);
                    });
                }
            });
        });
    }
    
    selectIdentityAsync(entity, attribute) {
        return new Promise((resolve, reject) => {
            return this.selectIdentity(entity, attribute, (err, value) => {
                if (err) {
                    return reject(err);
                }
                return resolve(value);
            });
        });
    }
    /**
     * Executes an operation against database and returns the results.
     * @param {*} batch
     * @param {function(Error=)} callback
     */
    executeBatch(batch, callback) {
        callback = callback || function () { };
        callback(new Error('DataAdapter.executeBatch() is obsolete. Use DataAdapter.executeInTransaction() instead.'));
    }
    table(name) {
        const self = this;
        return {
            /**
             * @param {function(Error,Boolean=)} callback
             */
            exists: function (callback) {
                self.execute('SELECT COUNT(*) count FROM sqlite_master WHERE name=? AND type=\'table\';', [name], function (err, result) {
                    if (err) {
                        callback(err);
                        return;
                    }
                    callback(null, (result[0].count > 0));
                });
            },
            existsAsync: function() {
                return new Promise((resolve, reject) => {
                    this.exists((err, value) => {
                        if (err) {
                            return reject(err);
                        }
                        return resolve(value);
                    });
                });
            },
            /**
             * @param {function(Error,string=)} callback
             */
            version: function (callback) {
                self.execute('SELECT MAX(version) AS version FROM migrations WHERE appliesTo=?', [name], function (err, result) {
                    if (err) {
                        return callback(err);
                    }
                    if (result.length === 0)
                        callback(null, '0.0');
                    else
                        callback(null, result[0].version || '0.0');
                });
            },
            versionAsync: function() {
                return new Promise((resolve, reject) => {
                    this.version((err, value) => {
                        if (err) {
                            return reject(err);
                        }
                        return resolve(value);
                    });
                });
            },
            /**
             * @param {function(Error,Boolean=)} callback
             */
            has_sequence: function (callback) {
                callback = callback || function () { };
                self.execute('SELECT COUNT(*) count FROM sqlite_sequence WHERE name=?', [name], function (err, result) {
                    if (err) {
                        callback(err);
                        return;
                    }
                    callback(null, (result[0].count > 0));
                });
            },
            has_sequenceAsync: function() {
                return new Promise((resolve, reject) => {
                    this.has_sequence((err, res) => {
                        if (err) {
                            return reject(err);
                        }
                        return resolve(res);
                    });
                });
            },
            /**
             * @param {function(Error=,Array=)} callback
             */
            columns: function (callback) {
                callback = callback || function () { };
                self.execute('PRAGMA table_info(?)', [name], function (err, result) {
                    if (err) {
                        callback(err);
                        return;
                    }
                    const arr = [];
                    /**
                     * enumerates table columns
                     * @param {{name:string},{cid:number},{type:string},{notnull:number},{pk:number}} x
                     */
                    const iterator = function (x) {
                        const col = { name: x.name, ordinal: x.cid, type: x.type, nullable: (x.notnull ? false : true), primary: (x.pk === 1) };
                        const matches = /(\w+)\((\d+),(\d+)\)/.exec(x.type);
                        if (matches) {
                            //extract max length attribute (e.g. integer(2,0) etc)
                            if (parseInt(matches[2]) > 0) {
                                col.size = parseInt(matches[2]);
                            }
                            //extract scale attribute from field (e.g. integer(2,0) etc)
                            if (parseInt(matches[3]) > 0) {
                                col.scale = parseInt(matches[3]);
                            }
                        }
                        arr.push(col);
                    };
                    result.forEach(iterator);
                    callback(null, arr);
                });
            },
            columnsAsync: function() {
                return new Promise((resolve, reject) => {
                    this.columns((err, res) => {
                        if (err) {
                            return reject(err);
                        }
                        return resolve(res);
                    });
                });
            },
            /**
             * 
             * @param {Array<*>} fields 
             * @param {Function} callback 
             */
            create: function(fields, callback) {
                //create table
                const strFields = fields.filter(function (x) {
                    return !x.oneToMany;
                }).map(function (x) {
                    return self.format('"%f" %t', x);
                }).join(', ');
                const sql = sprintf('CREATE TABLE "%s" (%s)', name, strFields);
                self.execute(sql, null, function (err) {
                    if (err) {
                        return callback(err);
                    }
                    return callback();
                });
            },
            createAsync: function(fields) {
                return new Promise((resolve, reject) => {
                    this.create(fields, (err, res) => {
                        if (err) {
                            return reject(err);
                        }
                        return resolve(res);
                    });
                });
            },
            /**
             * Alters the table by adding an array of fields
             * @param {Array<*>} fields
             * @param callback
             */
             add: function (fields, callback) {
                callback = callback || function () { };
                fields = fields || [];
                if (Array.isArray(fields) === false) {
                    //invalid argument exception
                    return callback(new Error('Invalid argument type. Expected Array.'));
                }
                if (fields.length === 0) {
                    // do nothing
                    return callback();
                }
                // generate SQL statement
                const formatter = new SqliteFormatter();
                const escapedTable = new SqliteFormatter().escapeName(name);
                const sql = fields.map((field) => {
                    const escapedField = formatter.escapeName(field.name);
                    return sprintf('ALTER TABLE %s ADD COLUMN %s %s', escapedTable, escapedField, self.formatType(field));
                }).join(';');
                self.execute(sql, [], function (err) {
                    callback(err);
                });
            },
            addAsync: function (fields) {
                return new Promise((resolve, reject) => {
                    this.add(fields, (err, res) => {
                        if (err) {
                            return reject(err);
                        }
                        return resolve(res);
                    });
                });
            },
            /**
             * Alters the table by modifying an array of fields
             * @param {Array<*>} fields
             * @param callback
             */
            change: function (fields, callback) {
                return callback(new Error('Full table migration is not yet implemented.'));
            },
            changeAsync: function (fields) {
                return new Promise((resolve, reject) => {
                    this.change(fields, (err, res) => {
                        if (err) {
                            return reject(err);
                        }
                        return resolve(res);
                    });
                });
            }
        };
    }
    view(name) {
        const self = this;
        return {
            /**
             * @param {function(Error,Boolean=)} callback
             */
            exists: function (callback) {
                self.execute('SELECT COUNT(*) count FROM sqlite_master WHERE name=? AND type=\'view\';', [name], function (err, result) {
                    if (err) {
                        callback(err);
                        return;
                    }
                    callback(null, (result[0].count > 0));
                });
            },
            existsAsync: function() {
                return new Promise((resolve, reject) => {
                    this.exists((err, value) => {
                        if (err) {
                            return reject(err);
                        }
                        return resolve(value);
                    });
                });
            },
            /**
             * @param {function(Error=)} callback
             */
            drop: function (callback) {
                callback = callback || function () { };
                self.open(function (err) {
                    if (err) {
                        callback(err);
                        return;
                    }
                    const sql = sprintf('DROP VIEW IF EXISTS `%s`', name);
                    self.execute(sql, undefined, function (err) {
                        if (err) {
                            callback(err);
                            return;
                        }
                        callback();
                    });
                });
            },
            dropAsync: function() {
                return new Promise((resolve, reject) => {
                    this.drop((err) => {
                        if (err) {
                            return reject(err);
                        }
                        return resolve();
                    });
                });
            },
            /**
             * @param {QueryExpression|*} q
             * @param {function(Error=)} callback
             */
            create: function (q, callback) {
                const thisArg = this;
                self.executeInTransaction(function (tr) {
                    thisArg.drop(function (err) {
                        if (err) {
                            tr(err);
                            return;
                        }
                        try {
                            let sql = sprintf('CREATE VIEW `%s` AS ', name);
                            const formatter = new SqliteFormatter();
                            sql += formatter.format(q);
                            self.execute(sql, undefined, tr);
                        }
                        catch (e) {
                            tr(e);
                        }
                    });
                }, function (err) {
                    callback(err);
                });
            },
            createAsync: function(q) {
                return new Promise((resolve, reject) => {
                    this.create(q, (err) => {
                        if (err) {
                            return reject(err);
                        }
                        return resolve();
                    });
                });
            }
        };
    }
    /**
     * Executes a query against the underlying database
     * @param query {QueryExpression|string|*}
     * @param values {*=}
     * @param {function(Error=,*=)} callback
     */
    execute(query, values, callback) {
        const self = this;
        /**
         * @type {string|null}
         */
        let sql = null;
        try {
            if (typeof query === 'string') {
                //get raw sql statement
                sql = query;
            }
            else {
                //format query expression or any object that may act as query expression
                const formatter = new SqliteFormatter();
                sql = formatter.format(query);
            }
            //validate sql statement
            if (typeof sql !== 'string') {
                callback.call(self, new Error('The executing command is of the wrong type or empty.'));
                return;
            }
            //ensure connection
            self.open(function (err) {
                if (err) {
                    callback.call(self, err);
                }
                else {
                    //log statement (optional)
                    if (process.env.NODE_ENV === 'development')
                        TraceUtils.log(sprintf('SQL:%s, Parameters:%s', sql, JSON.stringify(values)));
                    //prepare statement - the traditional way
                    const prepared = self.prepare(sql, values);
                    let fn;
                    //validate statement
                    if (/^(SELECT|PRAGMA)/ig.test(prepared)) {
                        //prepare for select
                        fn = self.rawConnection.all;
                    }
                    else {
                        //otherwise prepare for run
                        fn = self.rawConnection.run;
                    }
                    //execute raw command
                    fn.call(self.rawConnection, prepared, [], function (err, result) {
                        if (err) {
                            if (err.code === 'SQLITE_BUSY') {
                                const shouldRetry = typeof self.options.retry === 'number' && self.options.retry > 0;
                                if (shouldRetry === false) {
                                    TraceUtils.error(`SQL Error: ${prepared}`);
                                    return callback(err);
                                }
                                const retry = self.options.retry;
                                let retryInterval = 1000;
                                if (typeof self.options.retryInterval === 'number' && self.options.retryInterval > 0) {
                                    retryInterval = self.options.retryInterval;
                                }
                                // validate retry option
                                if (Object.prototype.hasOwnProperty.call(callback, 'retry') === false) {
                                    Object.defineProperty(callback, 'retry', {
                                        configurable: true,
                                        enumerable: false,
                                        value: 0,
                                        writable: true
                                    });
                                }
                                if (typeof callback.retry === 'number' && callback.retry >= (retry * retryInterval)) {
                                    delete callback.retry;
                                    return callback(err);
                                }
                                // retry
                                callback.retry += retryInterval;
                                TraceUtils.warn(`'SQL Error:${prepared}. Retrying in ${callback.retry} ms.'`);
                                return setTimeout(function () {
                                    self.execute(query, values, callback);
                                }, callback.retry);
                            }
                            // log sql
                            if (Object.prototype.hasOwnProperty.call(callback, 'retry')) {
                                delete callback.retry;
                            }
                            TraceUtils.error(`SQL Error: ${prepared}`);
                            callback(err);
                        }
                        else {
                            if (Object.prototype.hasOwnProperty.call(callback, 'retry')) {
                                delete callback.retry;
                            }
                            if (result) {
                                if (typeof result === 'object') {
                                    let keys;
                                    if (Array.isArray(result)) {
                                        if (result.length > 0) {
                                            keys = Object.keys(result[0]);
                                            result.forEach(function (x) {
                                                keys.forEach(function (y) {
                                                    const value = x[y];
                                                    if (typeof value === 'string' && SqlDateRegEx.test(value)) {
                                                        x[y] = new Date(value);
                                                    }
                                                });
                                            });
                                        }
                                    }
                                    else {
                                        keys = Object.keys(result);
                                        keys.forEach(function (y) {
                                            const value = result[y];
                                            if (typeof value === 'string' && SqlDateRegEx.test(value)) {
                                                result[y] = new Date(value);
                                            } 
                                        });
                                    }
                                }
                                return callback(null, result);
                            }
                            else {
                                return callback();
                            }
                        }
                    });
                }
            });
        }
        catch (e) {
            callback.call(self, e);
        }
    }

    /**
     * @param query {*}
     * @param values {*}
     * @returns Promise<any>
     */
    executeAsync(query, values) {
        return new Promise((resolve, reject) => {
            return this.execute(query, values, (err, res) => {
                if (err) {
                    return reject(err);
                }
                return resolve(res);
            });
        });
    }

    lastIdentity(callback) {
        const self = this;
        self.open(function (err) {
            if (err) {
                callback(err);
            }
            else {
                //execute lastval (for sequence)
                self.execute('SELECT last_insert_rowid() as lastval', [], function (err, lastval) {
                    if (err) {
                        callback(null, { insertId: null });
                    }
                    else {
                        lastval = lastval || [];
                        if (lastval.length > 0)
                            callback(null, { insertId: lastval[0].lastval });
                        else
                            callback(null, { insertId: null });
                    }
                });
            }
        });
    }

    lastIdentityAsync() {
        return new Promise((resolve, reject) => {
            return this.lastIdentity((err, value) => {
                if (err) {
                    return reject(err);
                }
                return resolve(value);
            });
        });
    }

    indexes(table) {
        const self = this, formatter = new SqliteFormatter();
        return {
            list: function (callback) {
                const this1 = this;
                if (Object.prototype.hasOwnProperty.call(this1, 'indexes_')) {
                    return callback(null, this1['indexes_']);
                }
                self.execute(sprintf('PRAGMA INDEX_LIST(`%s`)', table), null, function (err, result) {
                    if (err) {
                        return callback(err);
                    }
                    const indexes = result.filter(function (x) {
                        return x.origin === 'c';
                    }).map(function (x) {
                        return {
                            name: x.name,
                            columns: []
                        };
                    });
                    eachSeries(indexes, function (index, cb) {
                        self.execute(sprintf('PRAGMA INDEX_INFO(`%s`)', index.name), null, function (err, columns) {
                            if (err) {
                                return cb(err);
                            }
                            index.columns = columns.map(function (x) {
                                return x.name;
                            });
                            return cb();
                        });
                    }, function (err) {
                        if (err) {
                            return callback(err);
                        }
                        this1['indexes_'] = indexes;
                        return callback(null, indexes);
                    });
                });
            },
            listAsync: function() {
                return new Promise((resolve, reject) => {
                    this.list((err, results) => {
                        if (err) {
                            return reject(err);
                        }
                        return resolve(results);
                    });
                });
            },
            /**
             * @param {string} name
             * @param {Array|string} columns
             * @param {Function} callback
             */
            create: function (name, columns, callback) {
                const cols = [];
                if (typeof columns === 'string') {
                    cols.push(columns);
                }
                else if (Array.isArray(columns)) {
                    cols.push.apply(cols, columns);
                }
                else {
                    return callback(new Error('Invalid parameter. Columns parameter must be a string or an array of strings.'));
                }
                const thisArg = this;
                thisArg.list(function (err, indexes) {
                    if (err) {
                        return callback(err);
                    }
                    const ix = indexes.find(function (x) { return x.name === name; });
                    //format create index SQL statement
                    const sqlCreateIndex = sprintf('CREATE INDEX %s ON %s(%s)', formatter.escapeName(name), formatter.escapeName(table), cols.map(function (x) {
                        return formatter.escapeName(x);
                    }).join(','));
                    if (typeof ix === 'undefined' || ix === null) {
                        return self.execute(sqlCreateIndex, [], (err, result) => {
                            return callback(err, result)
                        });
                    }
                    else {
                        let nCols = cols.length;
                        //enumerate existing columns
                        ix.columns.forEach(function (x) {
                            if (cols.indexOf(x) >= 0) {
                                //column exists in index
                                nCols -= 1;
                            }
                        });
                        if (nCols > 0) {
                            //drop index
                            thisArg.drop(name, function (err) {
                                if (err) {
                                    return callback(err);
                                }
                                //and create it
                                self.execute(sqlCreateIndex, [], callback);
                            });
                        }
                        else {
                            //do nothing
                            return callback();
                        }
                    }
                });
            },
            createAsync: function(name, columns) {
                return new Promise((resolve, reject) => {
                    this.create(name, columns, (err) => {
                        if (err) {
                            return reject(err);
                        }
                        return resolve();
                    });
                });
            },
            drop: function (name, callback) {
                if (typeof name !== 'string') {
                    return callback(new Error('Name must be a valid string.'));
                }
                self.execute(sprintf('PRAGMA INDEX_LIST(`%s`)', table), null, function (err, result) {
                    if (err) {
                        return callback(err);
                    }
                    const exists = typeof result.find(function (x) { return x.name === name; }) !== 'undefined';
                    if (!exists) {
                        return callback();
                    }
                    const formatter = new SqliteFormatter();
                    self.execute(sprintf('DROP INDEX %s', formatter.escapeName(name)), [], callback);
                });
            },
            dropAsync: function(name) {
                return new Promise((resolve, reject) => {
                    this.drop(name, (err) => {
                        if (err) {
                            return reject(err);
                        }
                        return resolve();
                    });
                });
            }
        };
    }
}

export {
    SqliteAdapter
};
