'use strict';

module.exports = function (grunt) {

  require('time-grunt')(grunt);

  var config = {

    babel: {
      options: {
        plugins: ['uglify:after'],
        sourceMap: true
      },
      dist: {
        files: [{
          expand: true,
          cwd: './src',
          src: '**/*.js',
          dest: './dist',
          ext: '.js'
        }]
      }
    },

    copy: {
      main: {
        files: [
          {
            expand: true,
            cwd: 'src/',
            src: ['**/*.json', '**/*.html', '**/*.png'],
            dest: 'dist/'
          }
        ],
      },
    },

    run: {
      npmLocalInstall: {
        cmd: 'npm',
        args: [ 'install' ]
      }
    },
    
    clean: {
      dist: {
        files: [{
          dot: true,
          src: [
            './dist/*',
            './*.tgz',
            './node_modules/local-node-*',
            './services/environment',
            './services/start_systemd.sh',
            './services/systemd/candy-red.service',
            './services/systemd/environment',
            './services/start_sysvinit.sh',
            './services/sysvinit/environment',
            './services/sysvinit/wrapper.sh'
          ]
        }]
      }
    },

    jshint: {
      options: {
        jshintrc: '.jshintrc',
        reporter: require('jshint-stylish')
      },
      all: [
        './*.js',
        './test/src/**/*.js',
        './src/**/*.js'
      ]
    },
    mochaTest: {
      all: {
        options: {
          require: 'babel/register'
        },
        src: ['./test/src/**/*.js']
      }
    },
  };
    
  grunt.initConfig(config);
  
  grunt.loadNpmTasks('grunt-contrib-clean');
  grunt.loadNpmTasks('grunt-contrib-jshint');
  grunt.loadNpmTasks('grunt-contrib-copy');
  grunt.loadNpmTasks('grunt-babel');
  grunt.loadNpmTasks('grunt-mocha-test');
  grunt.loadNpmTasks('grunt-run');

  grunt.registerTask('pre-run', function() {
    var fs = require('fs');
    fs.readdirSync('./dist/nodes/').forEach(function(f) {
      if (f.indexOf('local-node-') === 0) {
        config.run.npmLocalInstall.args.push('./dist/nodes/' + f);
      }
    });
  });

  grunt.registerTask('test', [
    'babel',
    'copy',
    'run',
    'jshint',
    'mochaTest'
  ]);

  grunt.registerTask('build', [
    'clean',
    'babel',
    'copy',
    'pre-run',
    'run',
  ]);

  grunt.registerTask('default', [
    'test',
    'build'
  ]);
};
