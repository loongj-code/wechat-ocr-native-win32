'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const SRC_DIR = path.join(ROOT, 'src');
const VENDOR_DIR = path.join(ROOT, 'vendor');
const NM_KOFFI = path.join(ROOT, 'node_modules', 'koffi');
const DIST = path.join(ROOT, 'dist');
const PKG = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));

function rmrf(target) {
  if (fs.existsSync(target)) {
    fs.rmSync(target, { recursive: true, force: true });
  }
}

function copyDir(src, dest) {
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const s = path.join(src, entry.name);
    const d = path.join(dest, entry.name);
    if (entry.isSymbolicLink()) {
      const real = fs.realpathSync(s);
      const stat = fs.statSync(real);
      if (stat.isDirectory()) copyDir(real, d);
      else fs.copyFileSync(real, d);
    } else if (entry.isDirectory()) {
      copyDir(s, d);
    } else if (entry.isFile()) {
      fs.copyFileSync(s, d);
    }
  }
}

function copyFile(src, dest) {
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.copyFileSync(src, dest);
}

function copyKoffiMinimal(src, dest) {
  const files = [
    'index.js',
    'index.d.ts',
    'LICENSE.txt',
    'build/koffi/win32_x64/koffi.node'
  ];
  for (const rel of files) {
    const s = path.join(src, rel);
    if (!fs.existsSync(s)) {
      throw new Error(`koffi missing required file: ${rel}`);
    }
    copyFile(s, path.join(dest, rel));
  }
  const koffiPkg = JSON.parse(fs.readFileSync(path.join(src, 'package.json'), 'utf8'));
  delete koffiPkg.scripts;
  fs.mkdirSync(dest, { recursive: true });
  fs.writeFileSync(path.join(dest, 'package.json'), JSON.stringify(koffiPkg, null, 2));
}

function main() {
  console.log('[build] root:', ROOT);
  rmrf(DIST);
  fs.mkdirSync(DIST, { recursive: true });

  copyFile(path.join(SRC_DIR, 'index.js'), path.join(DIST, 'index.js'));
  console.log('[build] copied src/index.js');

  copyDir(path.join(VENDOR_DIR, 'win32-x64'), path.join(DIST, 'vendor', 'win32-x64'));
  console.log('[build] copied vendor/win32-x64');

  if (!fs.existsSync(NM_KOFFI)) {
    throw new Error('koffi not installed under node_modules/koffi; run npm install first');
  }
  copyKoffiMinimal(NM_KOFFI, path.join(DIST, 'node_modules', 'koffi'));
  console.log('[build] copied node_modules/koffi (win32_x64 only)');

  const distPkg = {
    name: PKG.name,
    version: PKG.version,
    description: PKG.description,
    main: 'index.js',
    os: PKG.os,
    cpu: PKG.cpu,
    engines: PKG.engines,
    license: PKG.license
  };
  fs.writeFileSync(path.join(DIST, 'package.json'), JSON.stringify(distPkg, null, 2));
  console.log('[build] wrote dist/package.json');

  console.log('[build] done. dist =', DIST);
}

main();
