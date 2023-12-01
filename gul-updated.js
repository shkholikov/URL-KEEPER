"use strict";

const gulp = require('gulp');
const build = require("@microsoft/sp-build-web");
const ts = require('gulp-typescript');

// Existing code in your gulp.js...
// ...

// Define TypeScript project for your worker
const tsWorker = ts.createProject('src/path/to/your/tsconfig.worker.json');

// Gulp task to transpile the worker TypeScript file
gulp.task('transpile-worker', () => {
  return tsWorker.src()
    .pipe(tsWorker())
    .js.pipe(gulp.dest('dist')); // Change 'dist' to your desired output directory
});

// Modify the serve task to include your new transpile task
var getTasks = build.rig.getTasks;
build.rig.getTasks = function () {
    var result = getTasks.call(build.rig);

    // Add your transpile task to the serve sequence
    const serve = result.get('serve');
    result.set('serve', gulp.series('transpile-worker', serve));

    return result;
};

// Rest of your existing gulp.js code...
// ...


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
