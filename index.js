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
let replace = require('gulp-replace-task');
let ts = require('gulp-typescript');
let concat = require('gulp-concat');
let gulpif = require('gulp-if');
let uglify = require('gulp-uglify-es').default;
let buffer = require('vinyl-buffer');
let babel = require('gulp-babel');

sass.compiler = require('node-sass');

let options = {
    port: 5555,
    rootDir: './',
    baseDir: 'app',
    buildDir: 'build/',
    configDir: null,
    tsConfig: null,
    shouldConcatCss: false,
    shouldMinifyBundle: false,
    uglifyOptions: {
        output: {
            comments: /^\s*@/
            // will keep all comments beginning with ' @'
        }
    },
    bundleOpts: {}
}

let domain = {
    name: 'DEVO',
    apiEndpoint: 'https://otr-backend-service-us-devo.offtherecord.com',
    stripeClientId: 'ca_6TCbA0GpnmIafv7SC53zClcFYNajc6st',
    stripePublishableKey: 'pk_test_fHIOKc7Sf7gNjwUIIT3XJfDt',
    customerSiteUrl: 'https://brochure-devo.offtherecord.com',
    debugLog: 'true'
};

if (argv.domain === 'prod') {
    domain.name = 'PROD';
    domain.apiEndpoint = 'https://otr-backend-service-us-prod.offtherecord.com';
    domain.stripeClientId = 'ca_6TCbZWE2tFU2EXiOWrkKK3KA5h0NMFIv';
    domain.stripePublishableKey = 'pk_live_tfkS6orQi9EW3DePjrkHNLMT';
    domain.customerSiteUrl = 'https://offtherecord.com';
    domain.debugLog = argv.debug ? 'true' : 'false';

} else if (argv.domain === 'local') {
    domain.name = 'LOCAL';
    domain.apiEndpoint = 'http://localhost:8080';
    domain.stripeClientId = 'ca_6TCbA0GpnmIafv7SC53zClcFYNajc6st';
    domain.stripePublishableKey = 'pk_test_fHIOKc7Sf7gNjwUIIT3XJfDt';
}

function replaceVars() {

    return gulp.src(options.configDir + "**/*.ts", {base: '.'})
        .pipe(ts()).js
        .pipe(replace({
            patterns: [
                {
                    match: 'domain-name',
                    replacement: domain.name
                },
                {
                    match: 'endpoint',
                    replacement: domain.apiEndpoint
                },
                {
                    match: 'stripeClientId',
                    replacement: domain.stripeClientId
                },
                {
                    match: 'stripePublishableKey',
                    replacement: domain.stripePublishableKey
                },
                {
                    match: 'debugLog',
                    replacement: domain.debugLog
                },
                {
                    match: 'customerSiteUrl',
                    replacement: domain.customerSiteUrl
                }
            ]
        }))
        .pipe(gulp.dest(options.buildDir))
        .pipe(connect.reload());
}


function minifySass() {
    return gulp.src(options.baseDir + '/**/*.scss')
        .pipe(sass.sync())
        .pipe(cleanCSS({debug: true, compatibility: 'ie8'}, function(details) {
            console.log(details.name + ': ' + details.stats.minifiedSize);
        }))
        .pipe(gulpif(options.shouldConcatCss, concat('all-otr.min.css')))
        .pipe(gulp.dest(options.buildDir))
        .pipe(connect.reload());
}

function compileTs() {
    return gulp.src([options.baseDir + '/**/*.ts'])
        .pipe(babel({
            plugins: [
                ['@babel/plugin-transform-typescript'],
                ['babel-plugin-transform-remove-imports', { test: '.' }]
            ]
        }))
        .pipe(ts(options.tsConfig ? options.tsConfig.compilerOptions : undefined)).js
        .pipe(gulp.dest(options.buildDir));
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
            .pipe(buffer())
            .pipe(replace({
                patterns: [
                    {
                        match: 'domain-name',
                        replacement: domain.name
                    },
                    {
                        match: 'endpoint',
                        replacement: domain.apiEndpoint
                    },
                    {
                        match: 'stripeClientId',
                        replacement: domain.stripeClientId
                    },
                    {
                        match: 'stripePublishableKey',
                        replacement: domain.stripePublishableKey
                    },
                    {
                        match: 'debugLog',
                        replacement: domain.debugLog
                    },
                    {
                        match: 'customerSiteUrl',
                        replacement: domain.customerSiteUrl
                    }
                ]
            }))
            .pipe(gulpif(options.shouldMinifyBundle, buffer()))
            .pipe(gulpif(options.shouldMinifyBundle, uglify(options.uglifyOptions)))
            .pipe(gulp.dest(options.buildDir))
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

exports.bundle = bundle;
exports.minifySass = minifySass;
exports.clean = clean;
exports.connectServer = connectServer;
exports.replaceVars = replaceVars;
exports.compileTs = compileTs;

module.exports = {
    setOptions: (opts) => {
        options = assign({}, options, opts);
        log.info("Web builder options to build with are: ", options);
    },
    copyNodeModules: copyNodeModules,
    bundle: bundle,
    clean: clean,
    connectServer: connectServer,
    minifySass: minifySass,
    replaceVars: replaceVars,
    compileTs, compileTs
};
