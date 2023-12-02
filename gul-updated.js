"use strict";

const build = require("@microsoft/sp-build-web");
const gulp = require("gulp");
const ts = require("gulp-typescript");
const log = require('@microsoft/gulp-core-build').log;

// Suppress specific warnings (existing setup)
build.addSuppression(`Warning - [sass] The local CSS class 'ms-Grid' is not camelCase and will not be type-safe.`);

// Custom task to compile TypeScript workers
gulp.task("compile-workers", () => {
    const tsProject = ts.createProject("tsconfig.json");
    return gulp.src('./src/workers/*.ts') // Adjust the path to your TypeScript workers
        .pipe(tsProject())
        .pipe(gulp.dest('./temp/workers')) // Output directory for compiled workers
        .on('end', () => {
            log('Compiled TypeScript workers.');
        });
});

// Custom task to copy compiled workers to the build directory
gulp.task("copy-workers", () => {
    return gulp.src('./temp/workers/*.js')
        .pipe(gulp.dest('./lib/workers')) // Copying the compiled workers to the build directory
        .on('end', () => {
            log('Copied compiled workers to build directory.');
        });
});

// Overriding the existing build task
build.task('build', build.serial('compile-workers', 'copy-workers', build.rig.getBuildTask()));

// Fast-serve integration (existing setup)
const { addFastServe } = require("spfx-fast-serve-helpers");
addFastServe(build);

// Initialize the custom build pipeline
build.initialize(require("gulp"));


{
  "compilerOptions": {
    "target": "es5",
    "lib": ["webworker", "es2015"],
    "module": "esnext",
    "moduleResolution": "node",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": false,
    "outDir": "./dist", // or your preferred output directory
  },
  "include": [
    "src/path/to/your/worker/**/*.ts" // Adjust this path to include your worker files
  ],
  "exclude": [
    "node_modules"
  ]
}


build.initialize(require("gulp"));

Error - [webpack] 'dist':
./lib/webparts/obb/pages/Statistics.js 235:97
Module parse failed: Unexpected token (235:97)
File was processed with these loaders:
 * ./node_modules/source-map-loader/dist/cjs.js
You may need an additional loader to handle the result of these loaders.
|     //     }
|     // }, [state.inspections]);
>     var worker = useMemo(function () { return new Worker(new URL("./statistics.worker.ts", import.meta.url)); }, []);
|     useEffect(function () {
|         if (state.inspections.length > 0) {
 @ ./lib/webparts/obb/routes/Router.js 60:0-45 133:195-205
 @ ./lib/webparts/obb/App.js
 @ ./lib/webparts/obb/ObbWebPart.js
  
