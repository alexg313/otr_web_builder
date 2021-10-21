# OTR Web Builder

> A shared gulpfile to reduce build task duplication which will increase standardization,
> offer lower maintenance on updates across our applications

## Usage

Install the web builder with npm

```sh
npm i --save-dev @otr-app/web-builder
```

Import it in gulpfile.js

```javascript
let webBuilder = require('@otr-app/web-builder');
```


## Configuration

Below is the default configuration that can be overwritten with the setOptions method.

```js
let options = {
    tsConfig: null,
    port: 5555,
    rootDir: './',
    baseDir: 'app',
    buildDir: 'build/',
    buildCssDir: 'build/assets/css',
    bundleOpts: {
        basedir: "app",
        debug: (argv.domain || 'devo') !== 'prod',
        entries: ['index.ts'],
        cache: {},
        packageCache: {}
    }
}
```

## Customize

Here's an example of overriding the options above.

```js
webBuilder.setOptions({
    tsConfig: require('./tsconfig.json'), // override with local ts config
    port: 8889,
    baseDir: 'webapp',
    bundleOpts: {
        basedir: 'webapp',
        entries: ['index.ts'],
        debug: true 
    }
});
```

Example of using tasks from @otr-app/web-builder in side a consumer. List of all re-usable gulp tasks located [here](#tasks)

```js
// otr_admin_web_app - gulpfile.js
exports.clean = webBuilder.clean;
exports.build = gulp.series(
    copySrc,
    webBuilder.copyNodeModules,
    webBuilder.bundle,
    gulp.parallel(
        webBuilder.minifySass,
        minifyJs,
        replaceVars)
);
```

## Tasks

- bundle
    - compiles typescripts and bundles all dependencies
     and source code into one file
- minifySass
- copyNodeModules
    - copies package.json into build/ and installs all the production dependencies into build/
- clean
    - deletes build/
- connectServer
    - launches a local server at port defined in setOptions
- More to be added

## Testing

To test tasks locally
```sh
gulp -f index.js <task_name>
```