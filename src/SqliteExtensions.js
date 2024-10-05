import path from 'path';

const SqliteExtensions = {
    uuid: path.resolve(__dirname, '../lib/uuid'), // Universally Unique Identifiers
    crypto: path.resolve(__dirname, '../lib/crypto'), // hashing, encoding and decoding data
    regexp: path.resolve(__dirname, '../lib/regexp'), // regular expressions
    time: path.resolve(__dirname, '../lib/time') // high-precision date/time
}

export {
    SqliteExtensions
}
