import path from 'path';

const SqliteExtensions = {
    uuid: path.resolve(__dirname, '../lib/uuid'), // Universally Unique Identifiers
    crypto: path.resolve(__dirname, '../lib/libsqlite_hashes'), // hashing, encoding and decoding data
    regexp: path.resolve(__dirname, '../lib/regex0') // regular expressions
}

export {
    SqliteExtensions
}
