// validates svgo opts
// to contain minimal set of plugins that will strip some stuff
// for the babylon JSX parser to work
import Svgo from 'svgo';
import isPlainObject from 'lodash.isplainobject';

const essentialPlugins = ['removeDoctype', 'removeComments'];

function isEssentialPlugin(p) {
  return essentialPlugins.indexOf(p) !== -1;
}

function encodeSVGDatauri(str, type) {
  let prefix = 'data:image/svg+xml';

  // base64
  if (!type || type === 'base64') {
    prefix += ';base64,';

    if (Buffer.from) {
      str = prefix + Buffer.from(str).toString('base64');
    } else {
      // eslint-disable-next-line
      str = prefix + new Buffer(str).toString('base64')
    }

    // URI encoded
  } else if (type === 'enc') {
    str = `${prefix},${encodeURIComponent(str)}`;

    // unencoded
  } else if (type === 'unenc') {
    str = `${prefix},${str}`;
  }

  return str;
}

function validateAndFix(opts) {
  if (!isPlainObject(opts)) return;

  if (opts.full) {
    if (
      typeof opts.plugins === 'undefined'
      || (Array.isArray(opts.plugins) && opts.plugins.length === 0)
    ) {
      /* eslint no-param-reassign: 1 */
      opts.plugins = [...essentialPlugins];
      return;
    }
  }

  // opts.full is false, plugins can be empty
  if (typeof opts.plugins === 'undefined') return;
  if (Array.isArray(opts.plugins) && opts.plugins.length === 0) return;

  // track whether its defined in opts.plugins
  const state = essentialPlugins.reduce((p, c) => Object.assign(p, { [c]: false }), {});

  opts.plugins.forEach((p) => {
    if (typeof p === 'string' && isEssentialPlugin(p)) {
      state[p] = true;
    } else if (typeof p === 'object') {
      Object.keys(p).forEach((k) => {
        if (isEssentialPlugin(k)) {
          // make it essential
          if (!p[k]) p[k] = true;
          // and update state
          /* eslint no-param-reassign: 1 */
          state[k] = true;
        }
      });
    }
  });

  Object.keys(state)
    .filter((key) => !state[key])
    .forEach((key) => opts.plugins.push(key));
}

function optimizeSync(svgstr, info) {
  const { config } = this;

  if (config.error) {
    throw config.error;
  }

  const maxPassCount = config.multipass ? 10 : 1;
  let counter = 0;
  let prevResultSize = Number.POSITIVE_INFINITY;

  let result;

  const optimizeOnceCallback = (svgjs) => {
    if (svgjs.error) {
      throw svgjs.error;
    }

    // eslint-disable-next-line no-plusplus
    if (++counter < maxPassCount && svgjs.data.length < prevResultSize) {
      prevResultSize = svgjs.data.length;
      // eslint-disable-next-line no-underscore-dangle
      this._optimizeOnce(svgjs.data, info, optimizeOnceCallback);
    } else {
      if (config.datauri) {
        svgjs.data = encodeSVGDatauri(svgjs.data, config.datauri);
      }
      if (info.path) {
        svgjs.path = info.path;
      }

      result = svgjs;
    }
  };

  // eslint-disable-next-line no-underscore-dangle
  this._optimizeOnce(svgstr, info, optimizeOnceCallback);
  return result;
}

function getInfo(state) {
  return state.filePath
    ? { input: 'file', path: state.filePath }
    : { input: 'string' };
}

export default function optimize(content, opts = {}, state) {
  validateAndFix(opts);
  const svgo = new Svgo(opts);

  // Svgo isn't _really_ async, so let's do it this way:
  const { data } = optimizeSync.call(svgo, content, getInfo(state));
  return data;
}
