// Preloaded by this project's runtime and npm entry points. Miniflare starts
// workerd in a grandchild process, so hiding the first Node process is not enough.
const childProcess = require('node:child_process');
const { syncBuiltinESMExports } = require('node:module');
const { isAbsolute, resolve } = require('node:path');
const { promisify } = require('node:util');
const installed = Symbol.for('spotlog.localHiddenChildren');

function hiddenArguments(argumentsAfterCommand, name = 'spawn') {
  const args = [...argumentsAfterCommand];
  // exec has no argv parameter. The other APIs accept argv before options,
  // including an explicit null/undefined argv placeholder. Always replace the
  // correct options slot rather than appending an argument native Node ignores.
  const first = args[0];
  const index =
    name === 'exec' || name === 'execSync'
      ? 0
      : args.length === 0 ||
          typeof first === 'function' ||
          (first !== null && typeof first === 'object' && !Array.isArray(first))
        ? 0
        : 1;
  if (typeof args[index] === 'function') {
    args.splice(index, 0, { windowsHide: true });
  } else {
    args[index] = { ...args[index], windowsHide: true };
  }
  return args;
}

function installHiddenChildren(
  target = childProcess,
  platform = process.platform,
) {
  if (platform !== 'win32' || target[installed]) return false;
  for (const name of [
    'spawn',
    'spawnSync',
    'exec',
    'execSync',
    'execFile',
    'execFileSync',
    'fork',
  ]) {
    const original = target[name];
    const wrapped = function (command, ...args) {
      return Reflect.apply(original, this, [
        command,
        ...hiddenArguments(args, name),
      ]);
    };
    // Node's custom exec/execFile promisifier returns { stdout, stderr } plus
    // promise.child. Keep that contract while applying the same hidden options.
    if (original[promisify.custom]) {
      Object.defineProperty(wrapped, promisify.custom, {
        value: function (command, ...args) {
          return Reflect.apply(original[promisify.custom], this, [
            command,
            ...hiddenArguments(args, name),
          ]);
        },
      });
    }
    target[name] = wrapped;
  }
  Object.defineProperty(target, installed, { value: true });
  if (target === childProcess) {
    // CLI --require arguments are not inherited by spawn(). Use an absolute
    // NODE_OPTIONS preload so Node descendants remain protected after chdir.
    // Keep the same flag as backgroundEnvironment(), without duplicating it.
    const flag = `--require=${JSON.stringify(__filename)}`;
    const current = process.env.NODE_OPTIONS || '';
    if (!current.includes(flag))
      process.env.NODE_OPTIONS = `${current} ${flag}`.trim();
    // fork() inherits execArgv as well as NODE_OPTIONS. Normalize only this
    // preload's relative CLI path before a child can use another working dir.
    const ownRelativePreload = (value) =>
      typeof value === 'string' &&
      !isAbsolute(value) &&
      resolve(value).toLowerCase() === __filename.toLowerCase();
    for (let index = 0; index < process.execArgv.length; index++) {
      const argument = process.execArgv[index];
      if (argument === '--require' || argument === '-r') {
        if (ownRelativePreload(process.execArgv[index + 1]))
          process.execArgv[index + 1] = __filename;
        index++;
      } else if (
        argument.startsWith('--require=') &&
        ownRelativePreload(argument.slice('--require='.length))
      ) {
        process.execArgv[index] = `--require=${__filename}`;
      }
    }
    syncBuiltinESMExports();
  }
  return true;
}

installHiddenChildren();
module.exports = { hiddenArguments, installHiddenChildren };
