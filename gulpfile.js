var gulp       = require('gulp');
var babel      = require('gulp-babel');
var debug      = require('gulp-debug');
var sourcemaps = require('gulp-sourcemaps');
var marked     = require('gulp-marked');
var source     = require('vinyl-source-stream');
var browserify = require('browserify');
var watchify   = require('watchify');
var gulpif     = require('gulp-if');
var uglify     = require('gulp-uglify');
var streamify  = require('gulp-streamify');
var notify     = require('gulp-notify');
var concat     = require('gulp-concat');
var cssmin     = require('gulp-cssmin');
var gutil      = require('gulp-util');
var fs         = require('fs');
var replace    = require('gulp-replace');
var chalk      = require('chalk');
var S          = require('string');
var yuidoc     = require('gulp-yuidoc');
var flatten    = require('gulp-flatten');
var n2a        = require('gulp-native2ascii');

var specific_rollup = (process.argv[3]) ? process.argv[3].replace('--', '') : undefined;
var dependencies = [];

//helper function for exporting modules into a global namespace
var _namespace = function(module){
    var base = "NetSage.Sankey.";
    return base + module; 
};

//helper function to log build notifications in a consistent manner 
var _notifyComplete = function(options){
    var name  = options.name;
    var start = options.start;
    var type  = (options.type == 'css') ? 'css' : 'js';
    var min   = (options.dev) ? '' : '.min';

    console.log(
        S('['+chalk.yellow(options.name+min+'.'+type)+']').padRight(40, '.').toString() +
        'built in ' + 
        chalk.magenta((Date.now() - start) + 'ms')
    );
};

var createJS = function(options){
    options = options || {};

    // if a specific rollup was requested and this is not it just return
    if(specific_rollup !== undefined && options.name != specific_rollup){
        return;
    }

    var start = new Date();

    var namespace =  _namespace(options.name);
    var name_lower = options.name.toLowerCase();

    var file_name = (options.dev) ? 'sankeynetsage_'+name_lower+'.js' : 'sankeynetsage_'+name_lower+'.min.js';
    return browserify('./src/js/index/'+options.name+'.js', {
            standalone: namespace
        })
        .bundle()
        .on('error', gutil.log)
        //Pass desired output filename to vinyl-source-stream
        .pipe(source(file_name))
        //get rid of windows newline cancer
        .pipe(replace(/\r\n/g,'\n'))
        //force ascii b/c mike bostock insists on putting
        //math symbols in his code
        .pipe(n2a({reverse: false}))
        //minify if not development
        .pipe(gulpif(!options.dev, streamify(uglify({
            output: {
                ascii_only: true
            }
        }))))
        //write the completed stream to dist
        .pipe(gulp.dest('./dist/js/'))
        .pipe(notify(function () {
            _notifyComplete({
                name:  name_lower,
                start: start,
                dev: options.dev
            });
        }));
};

var createCSS = function(options){
    options = options || {};
    
    // if a specific rollup was requested and this is not it just return
    if(specific_rollup !== undefined && options.name != specific_rollup){
        return;
    }

    var start = new Date();

    var name_lower = options.name.toLowerCase();

    var file_name = (options.dev) ? 'sankeynetsage_'+name_lower+'.css' : 'sankeynetsage_'+name_lower+'.min.css';
    gulp.src(options.files,{base: 'src/css/'})
        .pipe(concat(file_name))
        //get rid of windows newline cancer
        .pipe(replace(/\r\n/g,'\n'))
        //minify if not development
        .pipe(gulpif(!options.dev, streamify(cssmin())))
        .pipe(gulp.dest('./dist/css/'))
        .pipe(notify(function () {
            _notifyComplete({
                name:  name_lower,
                start: start,
                type: 'css',
                dev: options.dev
            });
        }));
};

var createPlugin = function(options){
    options = options || {};
    
    gulp.src(options.files)
       .pipe(debug())
       .pipe(sourcemaps.init())
       .pipe(babel({
	   presets:  ["es2015"],
           plugins: ['transform-es2015-modules-systemjs', "transform-es2015-for-of"],
       }))
        .pipe(sourcemaps.write('.'))
	.pipe(gulp.dest('./dist'));
}

//build all widgets
var buildAll = function(options){
    options = options || {};
    options.dev = options.dev || false;

    gulp.src('plugin.json').pipe(gulp.dest('./dist'));
    gulp.src('src/module.html').pipe(gulp.dest('./dist'));
    gulp.src('src/editor.html').pipe(gulp.dest('./dist'));
    gulp.src('src/docs_editor.html').pipe(gulp.dest('./dist'));
    gulp.src('src/table_editor.html').pipe(gulp.dest('./dist'));
    //gulp.src('src/display_editor.html').pipe(gulp.dest('./dist'));
    createPlugin({ files: [ './src/*.js',]});

    //create the d3.v3
    createJS({
        name: 'd3.v3',
        dev: options.dev
    });
    //create the sankey
    createJS({
        name: 'sankey',
        dev: options.dev
    });
    //create the sankey css
    createCSS({
        name: 'sankey',
        files: [
            './src/css/sankey.css'
        ],
        dev: options.dev
    });
};

//create api documentation with gulp-yuidoc
var _generateYuiAPIDocs = function(options){
    options = options || {};
 
    //generate our api documentation with the yuidoc plugin
    return gulp.src("./js/**/*.js")
        .pipe(yuidoc.parser({
            project: {
                "name": "NetSage Sankey",
                "description": "NetSage Sankey API ",
                "version": "1.0.3",
                "url": "http://www.netsage.global/",
                "themedir": "./node_modules/yuidoc-bootstrap-theme",
                "helpers": ["./node_modules/yuidoc-bootstrap-theme/helpers/helpers.js"]
            }
        }))
        .pipe(yuidoc.reporter())
        .pipe(yuidoc.generator())
        .pipe(gulp.dest('./dist/api_docs'));
};

//apply the bootstrap yui doc theme to the generated docs
var _applyBootstrapAPIDocTheme = function(){
    //copy over vendor assets from bootstrap theme
    gulp.src("./node_modules/yuidoc-bootstrap-theme/assets/vendor/**", { base: './node_modules/yuidoc-bootstrap-theme/vendor/*' })
        .pipe(gulp.dest('./dist/api_docs/assets/vendor/'));

    //copy over js assets from bootstrap theme
    gulp.src("./node_modules/yuidoc-bootstrap-theme/assets/js/**", { base: './node_modules/yuidoc-bootstrap-theme/js/*' })
        .pipe(gulp.dest('./dist/api_docs/assets/vendor/'));

    //copy over css assets from bootstrap theme
    return gulp.src("./node_modules/yuidoc-bootstrap-theme/assets/css/*")
        .pipe(flatten())
        .pipe(gulp.dest('./dist/api_docs/assets/css/'));
};

//apply some custom tweaks to the api documentation
var _applyCustomAPIDocTheme = function(){
    //copy over custom logo
    gulp.src("./images/netsage_atlas_logo_60o.png", { base: './images/' })
        .pipe(gulp.dest('./dist/api_docs/assets/css/'));

    //concatinate my custom css for the api docs onto the end of the custom
    //bootstrap docs
    return gulp.src([
        './dist/api_docs/assets/css/custom.css',
        './docs/css/api.css'
    ],{base: 'css/'})
        .pipe(concat('custom.css'))
        .pipe(gulp.dest('./dist/api_docs/assets/css/'))
};

//generate our landing doc page from the markdown document 
var buildDocs = function(options){
    return gulp.src('./docs/index.md')
        .pipe(marked({}))
        .pipe(gulp.dest('./dist/'))

};

//sample to include extra tasks
var _sampleExtraTask = function(){
    //gulp.src("./node_modules/cesium/Build/Cesium/**", { base: './node_modules/cesium/Build/Cesium/' }).pipe(gulp.dest('./dist/vendors/cesium/'));
    console.log("running sample extra task");
};
//hack to copy images
var _copyImages = function(){
    gulp.src("./src/**", { base: './src/' }).pipe(gulp.dest('./dist/src/'));
};

// build the documentation
gulp.task('_generate_yui_api_docs', _generateYuiAPIDocs);
gulp.task('_apply_bootstrap_api_doc_theme', ['_generate_yui_api_docs'], _applyBootstrapAPIDocTheme);
gulp.task('_apply_custom_api_doc_theme', ['_apply_bootstrap_api_doc_theme'], _applyCustomAPIDocTheme);
gulp.task('docs', ['_apply_custom_api_doc_theme'], function(){
    buildDocs();
});

gulp.task('_sample_extra_task', function(){
    _sampleExtraTask();
});
gulp.task('_copy_images', function(){
    _copyImages();
});
// Starts our development workflow
gulp.task('default', ['_sample_extra_task','_copy_images'], function () {
    //_copyCesium();
    buildAll({
        dev: true
    });
});

// Builds our minified production rollups
gulp.task('deploy', ['_sample_extra_task','_copy_images', 'docs'], function () {
    //_copyCesium();
    buildAll();
    buildAll({dev: true});
});
