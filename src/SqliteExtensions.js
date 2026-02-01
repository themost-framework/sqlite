import {resolve} from 'path';
// __dirname is not available in ES modules, so we define it here
const __dirname = __dirname || import.meta.dirname;

const SqliteExtensions = {
    uuid: resolve(__dirname, '../lib/uuid'), // Universally Unique Identifiers
    crypto: resolve(__dirname, '../lib/crypto'), // hashing, encoding and decoding data
    regexp: resolve(__dirname, '../lib/regexp') // regular expressions
}

export {
    SqliteExtensions
}
