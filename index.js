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
let sass = require('gulp-sass');
let cleanCSS = require('gulp-clean-css');
let del = require('del');

sass.compiler = require('node-sass');

let options = {
    port: 5555,
    rootDir: './',
    baseDir: 'app',
    buildDir: 'build/',
    buildCssDir: 'build/assets/css',
    bundleOpts: {}
}

function minifySass() {
    return gulp.src(options.baseDir + '/**/*.scss')
        .pipe(sass.sync())
        .pipe(cleanCSS({debug: true, compatibility: 'ie8'}, function(details) {
            console.log(details.name + ': ' + details.stats.minifiedSize);
        }))
        .pipe(gulp.dest(options.buildCssDir))
        .pipe(connect.reload());
}


function clean() {
    return del([options.buildDir]).then(function(paths) {
        console.log('Deleted files and folders:\n', paths.join('\n'));
    });
}

// Type gulp server --versioned for the versioned server
function connectServer(done) {
    connect.server({
        root: argv.versioned ? ['build/versioned'] : ['build'],
        port: options.port,
        livereload: true
    });
    done();
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
    let errorCount = 0;

    let bundler = function() {
        log("Bundling.. this may take awhile on the initial build...");
        return browserModules
            .bundle()
            .on('error', function (error) {
                ++errorCount;
                log.error(error.toString());
                hasErrors = true;
            })
            .pipe(source("bundle.js"))
            .pipe(gulp.dest(options.buildDir + options.baseDir))
            .pipe(connect.reload())
            .on('end', function() {
                if(hasErrors) {
                    throw new Error("Typescript compilation failed with " + errorCount + " errors");
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


// Un comment for local testing
/*
exports.bundle = bundle;
exports.minifySass = minifySass;
exports.clean = clean;
exports.connectServer = connectServer;
*/

module.exports = {
    setOptions: (opts) => {
        options = assign({}, options, opts);
        log.info("Web builder options to build with are: ", options);
    },
    copyNodeModules: copyNodeModules,
    bundle: bundle,
    clean: clean,
    connectServer: connectServer,
    minifySass: minifySass
};
