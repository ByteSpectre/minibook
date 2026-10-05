import path from 'node:path';

/** Windows CreateProcess limit ~8191 chars — chunk file lists for eslint/prettier. */
const CHUNK = 25;

function chunked(command, files) {
  const abs = files.map((f) => path.resolve(f));
  const cmds = [];
  for (let i = 0; i < abs.length; i += CHUNK) {
    const slice = abs.slice(i, i + CHUNK);
    cmds.push(`${command} ${slice.map((f) => JSON.stringify(f)).join(' ')}`);
  }
  return cmds;
}

export default {
  '*.{ts,tsx}': (files) => [
    ...chunked('eslint --fix', files),
    ...chunked('prettier --write', files),
  ],
  '*.{js,cjs,mjs,json,md,css,yml,yaml}': (files) => chunked('prettier --write', files),
};
