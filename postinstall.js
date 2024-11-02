const os = require('os');
const https = require('https');
const fs = require('fs');
const path = require('path');
const packageJson = require('./package.json');
const unzipper = require('unzipper');

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
    process.stdout.write('Downloading sqlite extensions\n');
    await downloadAsync(url, zipFile);
    // destination directory
    const dest = path.resolve(__dirname, './lib');
    // create destination directory
    await mkdirAsync(dest);
    process.stdout.write('Installing sqlite extensions\n');
    // unzip file
    await unzipAsync(zipFile, dest);
})().then(function(){
    return process.exit(0);
}).catch(function (err) {
    if (err.code === 'UNSUPPORTED_PLATFORM') {
        process.stderr.write(err.message + '\n');
        process.stdout.write('SQLite extensions are not available for this platform.\n');
        return process.exit(0);
    }
    process.stderr.write(err.message);
    return process.exit(1);
});
