"use strict";

var _interopRequireDefault = require("@babel/runtime/helpers/interopRequireDefault");

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports["default"] = optimize;

var _typeof2 = _interopRequireDefault(require("@babel/runtime/helpers/typeof"));

var _defineProperty2 = _interopRequireDefault(require("@babel/runtime/helpers/defineProperty"));

var _svgo = _interopRequireDefault(require("svgo"));

var _lodash = _interopRequireDefault(require("lodash.isplainobject"));

// validates svgo opts
// to contain minimal set of plugins that will strip some stuff
// for the babylon JSX parser to work
var essentialPlugins = ['removeDoctype', 'removeComments'];

function isEssentialPlugin(p) {
  return essentialPlugins.indexOf(p) !== -1;
}

function encodeSVGDatauri(str, type) {
  var prefix = 'data:image/svg+xml'; // base64

  if (!type || type === 'base64') {
    prefix += ';base64,';

    if (Buffer.from) {
      str = prefix + Buffer.from(str).toString('base64');
    } else {
      // eslint-disable-next-line
      str = prefix + new Buffer(str).toString('base64');
    } // URI encoded

  } else if (type === 'enc') {
    str = "".concat(prefix, ",").concat(encodeURIComponent(str)); // unencoded
  } else if (type === 'unenc') {
    str = "".concat(prefix, ",").concat(str);
  }

  return str;
}

function validateAndFix(opts) {
  if (!(0, _lodash["default"])(opts)) return;

  if (opts.full) {
    if (typeof opts.plugins === 'undefined' || Array.isArray(opts.plugins) && opts.plugins.length === 0) {
      /* eslint no-param-reassign: 1 */
      opts.plugins = [].concat(essentialPlugins);
      return;
    }
  } // opts.full is false, plugins can be empty


  if (typeof opts.plugins === 'undefined') return;
  if (Array.isArray(opts.plugins) && opts.plugins.length === 0) return; // track whether its defined in opts.plugins

  var state = essentialPlugins.reduce(function (p, c) {
    return Object.assign(p, (0, _defineProperty2["default"])({}, c, false));
  }, {});
  opts.plugins.forEach(function (p) {
    if (typeof p === 'string' && isEssentialPlugin(p)) {
      state[p] = true;
    } else if ((0, _typeof2["default"])(p) === 'object') {
      Object.keys(p).forEach(function (k) {
        if (isEssentialPlugin(k)) {
          // make it essential
          if (!p[k]) p[k] = true; // and update state

          /* eslint no-param-reassign: 1 */

          state[k] = true;
        }
      });
    }
  });
  Object.keys(state).filter(function (key) {
    return !state[key];
  }).forEach(function (key) {
    return opts.plugins.push(key);
  });
}

function optimizeSync(svgstr, info) {
  var _this = this;

  var config = this.config;

  if (config.error) {
    throw config.error;
  }

  var maxPassCount = config.multipass ? 10 : 1;
  var counter = 0;
  var prevResultSize = Number.POSITIVE_INFINITY;
  var result;

  var optimizeOnceCallback = function optimizeOnceCallback(svgjs) {
    if (svgjs.error) {
      throw svgjs.error;
    } // eslint-disable-next-line no-plusplus


    if (++counter < maxPassCount && svgjs.data.length < prevResultSize) {
      prevResultSize = svgjs.data.length; // eslint-disable-next-line no-underscore-dangle

      _this._optimizeOnce(svgjs.data, info, optimizeOnceCallback);
    } else {
      if (config.datauri) {
        svgjs.data = encodeSVGDatauri(svgjs.data, config.datauri);
      }

      if (info.path) {
        svgjs.path = info.path;
      }

      result = svgjs;
    }
  }; // eslint-disable-next-line no-underscore-dangle


  this._optimizeOnce(svgstr, info, optimizeOnceCallback);

  return result;
}

function getInfo(state) {
  return state.filePath ? {
    input: 'file',
    path: state.filePath
  } : {
    input: 'string'
  };
}

function optimize(content) {
  var opts = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : {};
  var state = arguments.length > 2 ? arguments[2] : undefined;
  validateAndFix(opts);
  var svgo = new _svgo["default"](opts); // Svgo isn't _really_ async, so let's do it this way:

  var _optimizeSync$call = optimizeSync.call(svgo, content, getInfo(state)),
      data = _optimizeSync$call.data;

  return data;
}