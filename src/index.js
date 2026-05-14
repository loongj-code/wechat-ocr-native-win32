'use strict';

const fs = require('fs');
const path = require('path');
const koffi = require('koffi');

function findVendorDll() {
  const candidates = [
    path.join(__dirname, 'vendor', 'win32-x64', 'wcocr.dll'),
    path.join(__dirname, '..', 'vendor', 'win32-x64', 'wcocr.dll')
  ];
  for (const c of candidates) {
    if (fs.existsSync(c)) return c;
  }
  return candidates[0];
}

const VENDOR_DLL = findVendorDll();

let lib = null;
let wechat_ocr = null;
let stop_ocr = null;
let inited = false;
let SetResCbProto = null;
let resolved = null;

function locateOcrExe() {
  if (process.env.WECHAT_OCR_EXE && fs.existsSync(process.env.WECHAT_OCR_EXE)) {
    return process.env.WECHAT_OCR_EXE;
  }
  const roots = [
    path.join(process.env.APPDATA || '', 'Tencent', 'xwechat', 'XPlugin', 'Plugins', 'WeChatOCR'),
    path.join(process.env.APPDATA || '', 'Tencent', 'WeChat',  'XPlugin', 'Plugins', 'WeChatOCR'),
    path.join(process.env.APPDATA || '', 'Tencent', 'Weixin',  'XPlugin', 'Plugins', 'WeChatOCR')
  ];
  for (const root of roots) {
    if (!fs.existsSync(root)) continue;
    const versions = fs.readdirSync(root)
      .map(name => ({ name, full: path.join(root, name) }))
      .filter(e => /^\d+$/.test(e.name) && fs.statSync(e.full).isDirectory())
      .sort((a, b) => Number(b.name) - Number(a.name));
    for (const v of versions) {
      const wxocr = path.join(v.full, 'extracted', 'wxocr.dll');
      const exe   = path.join(v.full, 'extracted', 'WeChatOCR.exe');
      if (fs.existsSync(wxocr)) return wxocr;
      if (fs.existsSync(exe))   return exe;
    }
  }
  return null;
}

function locateWechatDir() {
  if (process.env.WECHAT_DIR && fs.existsSync(process.env.WECHAT_DIR)) {
    return process.env.WECHAT_DIR;
  }
  let installPath = null;
  try {
    const { execSync } = require('child_process');
    const out = execSync(
      'reg query HKCU\\Software\\Tencent\\Weixin /v InstallPath',
      { stdio: ['ignore', 'pipe', 'ignore'] }
    ).toString();
    const m = out.match(/InstallPath\s+REG_SZ\s+(.+)/);
    if (m) installPath = m[1].trim();
  } catch { /* ignore */ }
  if (!installPath) return null;

  const versions = fs.readdirSync(installPath)
    .map(name => ({ name, full: path.join(installPath, name) }))
    .filter(e => /^\d+\.\d+/.test(e.name) && fs.statSync(e.full).isDirectory())
    .sort((a, b) => b.name.localeCompare(a.name, undefined, { numeric: true }));
  for (const v of versions) {
    if (fs.existsSync(path.join(v.full, 'mmmojo_64.dll'))) return v.full;
  }
  return null;
}

function loadLibrary(libPath) {
  if (lib) return;
  const dll = libPath || process.env.WCOCR_LIB_PATH || VENDOR_DLL;
  if (!fs.existsSync(dll)) {
    throw new Error(`OCR 运行库加载失败：${dll}`);
  }
  try {
    lib = koffi.load(dll);
  } catch (err) {
    throw new Error(`OCR 运行库加载失败：${dll}（${err && err.message ? err.message : err}）`);
  }
  SetResCbProto = koffi.proto('void SetResCb(const char *)');
  wechat_ocr = lib.func(
    'bool __cdecl wechat_ocr(const char16_t *ocr_exe, const char16_t *wechat_dir, const char *imgfn, SetResCb *cb)'
  );
  stop_ocr = lib.func('void __cdecl stop_ocr()');
}

function resolvePaths(options) {
  const ocrExe    = options.ocrExe    || (resolved && resolved.ocrExe)    || locateOcrExe();
  const wechatDir = options.wechatDir || (resolved && resolved.wechatDir) || locateWechatDir();
  if (!ocrExe)    throw new Error('未找到微信 OCR 引擎，请确认已安装 Weixin 4.x');
  if (!wechatDir) throw new Error('未找到微信安装目录（mmmojo_64.dll）');
  if (!fs.existsSync(ocrExe))    throw new Error(`未找到微信 OCR 引擎：${ocrExe}`);
  if (!fs.existsSync(wechatDir)) throw new Error(`未找到微信安装目录：${wechatDir}`);
  return { ocrExe, wechatDir };
}

function init(options = {}) {
  loadLibrary(options.libPath);
  resolved = resolvePaths(options);
  inited = true;
  return { ...resolved, libPath: options.libPath || VENDOR_DLL };
}

function parseArgs(arg, options) {
  if (typeof arg === 'string') {
    return { imagePath: arg, options: options || {} };
  }
  if (arg && typeof arg === 'object') {
    const { imagePath, ...rest } = arg;
    return { imagePath, options: { ...rest, ...(options || {}) } };
  }
  return { imagePath: '', options: options || {} };
}

function ocrJson(arg, optionsArg) {
  const { imagePath, options } = parseArgs(arg, optionsArg);
  if (!imagePath) throw new Error('图片路径不能为空');
  const abs = path.resolve(imagePath);
  if (!fs.existsSync(abs)) throw new Error(`图片不存在：${abs}`);

  if (!inited) init(options);

  const { ocrExe, wechatDir } = resolved;
  let captured = null;
  const cb = koffi.register((buf) => {
    captured = buf == null ? null
      : (typeof buf === 'string' ? buf : Buffer.from(buf).toString('utf8'));
  }, koffi.pointer(SetResCbProto));

  try {
    const ok = wechat_ocr(ocrExe, wechatDir, abs, cb);
    if (!ok) throw new Error('微信 OCR 调用失败');
    if (!captured) throw new Error('微信 OCR 未返回结果');
    return captured;
  } finally {
    koffi.unregister(cb);
  }
}

function normalizeOcrResult(raw) {
  if (typeof raw === 'string') {
    return {
      engine: 'wechat-windows',
      text: raw,
      lines: raw ? [{ text: raw }] : [],
      raw
    };
  }
  if (raw && typeof raw === 'object' && typeof raw.text === 'string') {
    const lines = Array.isArray(raw.lines) && raw.lines.length
      ? raw.lines.map(l => (typeof l === 'string' ? { text: l } : { text: String(l && l.text || '') }))
      : raw.text ? [{ text: raw.text }] : [];
    return {
      engine: raw.engine || 'wechat-windows',
      text: raw.text,
      lines,
      raw
    };
  }
  if (raw && typeof raw === 'object' && Array.isArray(raw.ocr_response)) {
    const lines = raw.ocr_response
      .map(b => ({ text: typeof b?.text === 'string' ? b.text : '' }))
      .filter(l => l.text);
    return {
      engine: 'wechat-windows',
      text: lines.map(l => l.text).join('\n'),
      lines,
      raw
    };
  }
  return { engine: 'wechat-windows', text: '', lines: [], raw };
}

function ocr(arg, optionsArg) {
  const json = ocrJson(arg, optionsArg);
  let parsed;
  try {
    parsed = JSON.parse(json);
  } catch {
    parsed = json;
  }
  return normalizeOcrResult(parsed);
}

function stop() {
  if (lib && stop_ocr) {
    stop_ocr();
    inited = false;
  }
}

module.exports = {
  init,
  ocr,
  ocrJson,
  stop,
  locateOcrExe,
  locateWechatDir
};
