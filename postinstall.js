const os = require('os');
const https = require('https');
const fs = require('fs');
const path = require('path');
const unzipper = require('unzipper');
const postinstallExtensions = require('./postinstall.extensions.json');
const semver = require('semver');
const tar = require('tar');

class NpmLogger {

    static logLevels = {
        silent: 0, error: 1, warn: 2, notice: 3, http: 4, timing: 5, info: 6, verbose: 7, silly: 8
    };

    constructor() {
        const npm_config_loglevel = process.env.npm_config_loglevel || 'notice';
        this.logLevel = NpmLogger.logLevels[npm_config_loglevel];
    }

    write() {
        process.stdout.write(Array.from(arguments).join(' ') + '\n');
    }

    error() {
        this.logLevel >= 1 && this.write('npm', 'error:', ...arguments);
    }

    warn() {
        this.logLevel >= 2 && this.write('npm', 'warn:', ...arguments);
    }

    log() {
       this.logLevel >= 3 && this.write('npm', 'notice:', ...arguments);
    }

    notice() {
        this.logLevel >= 3 && this.write('npm', 'notice:', ...arguments);
    }

    info() {
        this.logLevel >= 6 && this.write('npm', 'info:', ...arguments);
    }

    verbose() {
        this.logLevel >= 7 && this.write('npm', 'verbose:', ...arguments);
    }

    silly() {
        this.logLevel >= 8 && this.write('npm', 'silly:', ...arguments);
    }
    
}

function mkdirAsync(dir) {
    return new Promise((resolve, reject) => {
        // eslint-disable-next-line no-unused-vars
        void fs.stat(dir, function (err, stats) {
            if (err && err.code !== 'ENOENT') {
                return reject(err);
            }
            void fs.mkdir(dir, { recursive: true }, function (err) {
                if (err) {
                    return reject(err);
                }
                return resolve();
            });
        })
    });
}

function downloadAsync(url, dest) {
    return new Promise((resolve, reject) => {
        const file = fs.createWriteStream(dest);
        void https.get(url, function (response) {
            if (response.statusCode === 302 || response.statusCode === 301) {
                return downloadAsync(response.headers.location, dest)
                    .then(function() {
                        return resolve();
                    }).catch(function(err) {
                        return reject(err);
                    });
            }
            if (response.statusCode !== 200) {
                return reject(new Error(`Failed to download ${url} ` + response.statusMessage));
            }
            response.pipe(file);
            response.on('end', function () {
                file.on('finish', function () {
                    file.close(resolve);
                });
            });
        }).on('error', function (err) {
            return reject(err.message);
        });
    });
}

function unzipAsync(zipFile, dest) {
    return new Promise((resolve, reject) => {
        fs.createReadStream(zipFile).pipe(unzipper.Extract({ path: dest })).on('finish', resolve).on('error', reject);
    })
}

function untarAsync(tarFile, dest) {
    return new Promise((resolve, reject) => {
        tar.x({
            file: tarFile,
            cwd: dest
        }).then(() => {
            resolve();
        }).catch((err) => {
            reject(err);
        });
    });
}

(async function main() {
    const logger = new NpmLogger();
    await mkdirAsync(path.resolve(__dirname, './lib'));
    logger.notice('Installing sqlite extensions');
    return Promise.resolve();
})().then(() => {
    const platform = os.platform();
    const arch = os.arch();
    const keys = Object.keys(postinstallExtensions);
    const extensions = keys.map((name) => {
        /**
         * @type {{os: string[], cpu: string[], name: string, version?: string, engines: { [k: string]: string }, resolved: string, integrity: string}[]}
         */
        const options = postinstallExtensions[name];
        const found = options.filter((option) => option.os.includes(platform) && option.cpu.includes(arch));
        if (found.length === 1) {
            return Object.assign({}, found[0], {
                name
            });
        } else if (found.length > 1) {
            // handle multiple found options
            for (const option of found) {
                // get node engine version
                const nodeVersion = process.versions.node;
                const engineVersion = option.engines && option.engines.node;
                if (engineVersion && semver.satisfies(nodeVersion, engineVersion)) {
                    return Object.assign({}, option, {
                        name
                    });
                }
            }
        }
    }).filter((option) => typeof option !== 'undefined');

    return Promise.all(extensions.map((extension) => {
        const resolved = new URL(extension.resolved);
        const filename = path.basename(resolved.pathname);
        const tmpDest = path.join(os.tmpdir(), filename);
        const logger = new NpmLogger();
        logger.notice(`Downloading ${extension.name} from ${extension.resolved}`);
        return downloadAsync(extension.resolved, tmpDest).then(() => {
            // validate integrity
            const integrity = extension.integrity;
            if (integrity) {
                logger.notice(`Validating integrity for ${extension.name}`);
                const [algo, checksum] = integrity.split('-');
                const crypto = require('crypto');
                const hash = crypto.createHash(algo);
                const fileBuffer = fs.readFileSync(tmpDest);
                // noinspection JSCheckFunctionSignatures
                hash.update(fileBuffer);
                const calculatedHash = hash.digest('hex');
                if (calculatedHash !== checksum) {
                    throw new Error(`Integrity check failed for ${extension.name}. Expected ${integrity}, but got ${calculatedHash}`);
                }
            }
            return new Promise((resolve, reject) => {
                logger.notice(`Extracting ${extension.name} from ${filename}`);
                // get file extension
                const extname = path.extname(tmpDest);
                if (extname === '.zip') {
                    return unzipAsync(tmpDest, path.resolve(__dirname, './lib')).then(() => {
                        resolve();
                    }).catch((err) => {
                        reject(err);
                    });
                }
                return untarAsync(tmpDest, path.resolve(__dirname, './lib')).then(() => {
                    resolve();
                }).catch((err) => {
                    reject(err);
                });
            });
        });
    }));

}).then(function(){
    return process.exit(0);
}).catch(function (err) {
    const logger = new NpmLogger();
    if (err.code === 'UNSUPPORTED_PLATFORM') {
        logger.error(err.message);
        logger.error('SQLite extensions are not available for this platform');
        return process.exit(0);
    }
    logger.error(err.message);
    logger.error(err.stack);
    return process.exit(1);
});
