let gulp = require('gulp');
let spawn = require("child_process").spawn;
let browserify = require("browserify");
let source = require("vinyl-source-stream");
let tsify = require("tsify");
let watchify = require('watchify');
let argv = require('yargs').argv;
let assign = require('lodash.assign');
let log = require('fancy-log');
let connect = require('gulp-connect');

let options = {
    rootDir: "./",
    buildDir: "build/",
    bundleOpts: {}
}

function bundle(done, isWatchOn) {

    let defaultOpts = {
        basedir: "app",
        debug: (argv.domain || 'devo') !== 'prod',
        entries: ['index.ts'],
        cache: {},
        packageCache: {}
    };

    let addOverrides = assign(defaultOpts, options.bundleOpts);
    let opts = assign({}, watchify.args, addOverrides);
    let browserModules = watchify(browserify(opts).plugin(tsify));
    let hasErrors = false;

    let bundler = function() {
        log("Bundling.. this may take awhile on the initial build...");
        return browserModules
            .bundle()
            .on('error', function (error) {
                log.error(error.toString());
                hasErrors = true;
            })
            .pipe(source("bundle.js"))
            .pipe(gulp.dest("build/app"))
            .pipe(connect.reload())
            .on('end', function() {
                if(hasErrors) {
                    throw new Error("Typescript compilation failed");
                }
                log("Is watch on: ", isWatchOn);
                if(!isWatchOn) {
                    browserModules.close();
                }
                done();
            });
    }

    if(isWatchOn) {
        browserModules.on('update', bundler);
        browserModules.on('log', log.info);
    }

    return bundler();
}

function copyNodeModules(cb) {
    gulp.src(options.rootDir + "package.json")
        .pipe(gulp.dest(options.buildDir))
        .on('end', () => {
            let cmd = spawn('npm',  ['install', '--prefix', './build/', '--only', 'prod'], {stdio: 'inherit'});
            cmd.on('close', function (code) {
                log.info('Npm exited with code ' + code);
                cb(code);
            });
        })
}

exports.bundle = bundle;

module.exports = {
    opts: (opts) => {
        options = opts || options;
    },
    copyNodeModules: copyNodeModules,
    bundle: bundle
};
