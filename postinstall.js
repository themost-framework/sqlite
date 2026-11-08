const os = require('os');
const https = require('https');
const fs = require('fs');
const path = require('path');
const packageJson = require('./package.json');
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
        this.logLevel >= 1 && this.write('error:', ...arguments);
    }

    warn() {
        this.logLevel >= 2 && this.write('warn:', ...arguments);
    }

    log() {
       this.logLevel >= 3 && this.write(...arguments);
    }

    notice() {
        this.logLevel >= 3 && this.write('notice:', ...arguments);
    }

    info() {
        this.logLevel >= 6 && this.write('info:', ...arguments);
    }

    verbose() {
        this.logLevel >= 7 && this.write('verbose:', ...arguments);
    }

    silly() {
        this.logLevel >= 8 && this.write('silly:', ...arguments);
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
(async function main() {
    const logger = new NpmLogger();
    const rootUrl = 'https://github.com/nalgeon/sqlean/releases/download/';
    const version = packageJson.config.sqleanVersion;
    // get platform e.g. windows, macos, linux
    let platform = os.platform();
    // get architecture e.g. x64, arm64
    let arch = os.arch();
    switch (platform) {
        case 'win32':
            platform = 'win';
            break;
        case 'darwin':
            platform = 'macos';
            arch = arch === 'x64' ? 'x86' : arch;
            break;
        case 'linux':
            platform = 'linux';
            arch = arch === 'x64' ? 'x86' : arch;
            break;
        default:
            // eslint-disable-next-line no-case-declarations
            const err = new Error('Unsupported platform ' + platform);
            err.code = 'UNSUPPORTED_PLATFORM';
            throw err;
    }
    // get file name based on platform and arch
    const file = `sqlean-${platform}-${arch}.zip`;
    // format url
    const url = `${rootUrl}${version}/${file}`;
    // download zip file
    const zipFile = path.join(os.tmpdir(), file);
    logger.notice('Downloading sqlite extensions');
    await downloadAsync(url, zipFile);
    // destination directory
    const dest = path.resolve(__dirname, './lib');
    // create destination directory
    await mkdirAsync(dest);
    logger.notice('Installing sqlite extensions');
    // unzip file
    await unzipAsync(zipFile, dest);
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
        const tmpDest = path.join(os.tmpdir(), `${extension.name}.tar.gz`);
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
                logger.notice(`Extracting ${extension.name}`);
                return tar.x({
                    file: tmpDest,
                    cwd: path.resolve(__dirname, './lib')
                }).then(() => {
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
