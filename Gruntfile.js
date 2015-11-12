'use strict';

module.exports = function (grunt) {

  require('time-grunt')(grunt);

  grunt.initConfig({

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
            src: ['**/*.json', '**/*.html'],
            dest: 'dist/'
          },
        ],
      },
    },

    clean: {
      dist: {
        files: [{
          dot: true,
          src: [
            './dist/*',
            './*.tgz'
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
  });
  
  grunt.loadNpmTasks('grunt-contrib-clean');
  grunt.loadNpmTasks('grunt-contrib-jshint');
  grunt.loadNpmTasks('grunt-contrib-copy');
  grunt.loadNpmTasks('grunt-babel');
  grunt.loadNpmTasks('grunt-mocha-test');

  grunt.registerTask('test', [
    'babel',
    'copy',
    'jshint',
    'mochaTest'
  ]);

  grunt.registerTask('build', [
    'clean',
    'babel',
    'copy'
  ]);

  grunt.registerTask('default', [
    'test',
    'build'
  ]);
};
