# wechat-ocr-native-win32

English | [简体中文](./README.zh-CN.md)

Local WeChat (Weixin 4.x) OCR for Windows x64 — wraps swigger/wechat-ocr's `wcocr.dll` via [koffi](https://koffi.dev) (pure-JS FFI, no MSVC required).

> Built on top of [`swigger/wechat-ocr`](https://github.com/swigger/wechat-ocr) demo-7's `wcocr.dll`. The OCR engine and ML models belong to Tencent / WeChat and are **not** redistributed by this package — they are loaded from the user's local Weixin install at runtime.

## Requirements

- Windows 10/11 x64
- Node.js ≥ 18
- WeChat / Weixin 4.x installed locally, providing:
  - `mmmojo_64.dll` under the install dir (e.g. `C:\Program Files\Tencent\Weixin\<version>\`)
  - The OCR plugin under `%APPDATA%\Tencent\xwechat\XPlugin\Plugins\WeChatOCR\<build>\extracted\` (`wxocr.dll` ~24 MB + ML models)

The package auto-locates both. You can override with options or env vars (see [Configuration](#configuration)).

## Install

```bash
npm install @xiaojia5/wechat-ocr-native-win32
```

## Usage

```js
const wcocr = require('@xiaojia5/wechat-ocr-native-win32');

// Simplest form — pass an image path:
const result = wcocr.ocr('C:/path/to/image.png');

console.log(result.engine);          // 'wechat-windows'
console.log(result.text);            // joined plain text
console.log(result.lines.length);    // number of recognized lines

// Per-block geometry lives on the raw response:
for (const blk of result.raw.ocr_response || []) {
  console.log(blk.text, blk.left, blk.top, blk.right, blk.bottom);
}

wcocr.stop();
```

Object-form input lets you override paths per call:

```js
const result = wcocr.ocr({
  imagePath: 'C:/path/to/image.png',
  ocrExe:    'C:/.../WeChatOCR/<build>/extracted/wxocr.dll',
  wechatDir: 'C:/Program Files/Tencent/Weixin/4.0.0.26',
  libPath:   'C:/.../wcocr.dll'
});
```

## API

| Function | Returns | Notes |
|----------|---------|-------|
| `init(opts?)` | `{ ocrExe, wechatDir, libPath }` | Loads `wcocr.dll`, resolves paths, caches them. Optional — `ocr()` calls `init()` lazily on first use. |
| `ocr(arg, opts?)` | `{ engine, text, lines, raw }` | High-level call. `arg` may be a string path or `{ imagePath, ocrExe?, wechatDir?, libPath? }`. |
| `ocrJson(arg, opts?)` | `string` | Returns the raw JSON string from `wcocr.dll` without normalization. |
| `stop()` | `void` | Stops the OCR process and releases the loaded library. |
| `locateOcrExe()` | `string \| null` | Auto-discovers `wxocr.dll` from `%APPDATA%\Tencent\…\WeChatOCR\<build>\extracted\`. |
| `locateWechatDir()` | `string \| null` | Reads `HKCU\Software\Tencent\Weixin /v InstallPath` and finds the latest version dir containing `mmmojo_64.dll`. |

`ocr()` return shape:

```ts
{
  engine: 'wechat-windows',
  text:   string,                 // lines joined with '\n'
  lines:  Array<{ text: string }>,
  raw:    {
    errcode?: number,
    ocr_response?: Array<{
      text: string,
      left: number, top: number, right: number, bottom: number
    }>
  } | string                       // string if dll returned a non-JSON payload
}
```

## Configuration

### Options

```js
wcocr.init({
  ocrExe:    'C:/.../wxocr.dll',                     // or WeChatOCR.exe
  wechatDir: 'C:/Program Files/Tencent/Weixin/4.0.0.26',
  libPath:   'C:/.../wcocr.dll'                      // override bundled vendor dll
});
```

### Environment variables

| Variable | Example | Effect |
|----------|---------|--------|
| `WECHAT_OCR_EXE` | `C:\Users\me\AppData\Roaming\Tencent\xwechat\XPlugin\Plugins\WeChatOCR\8011\extracted\wxocr.dll` | Skip auto-discovery for the OCR engine |
| `WECHAT_DIR` | `C:\Program Files\Tencent\Weixin\4.0.0.26` | Skip registry lookup for the install dir |
| `WCOCR_LIB_PATH` | `D:\custom\wcocr.dll` | Use a different `wcocr.dll` instead of `vendor/win32-x64/wcocr.dll` |

### Auto-discovery details

- **OCR engine**: scans these roots for the highest-numbered build dir, then takes `extracted/wxocr.dll` (fallback: `extracted/WeChatOCR.exe`):
  - `%APPDATA%\Tencent\xwechat\XPlugin\Plugins\WeChatOCR\`
  - `%APPDATA%\Tencent\WeChat\XPlugin\Plugins\WeChatOCR\`
  - `%APPDATA%\Tencent\Weixin\XPlugin\Plugins\WeChatOCR\`
- **Install dir**: reads `HKCU\Software\Tencent\Weixin /v InstallPath`, picks the latest `<version>` subdir containing `mmmojo_64.dll`.

## Troubleshooting

| Error message | Likely cause | Fix |
|---------------|--------------|-----|
| `未找到微信 OCR 引擎，请确认已安装 Weixin 4.x` | `wxocr.dll` not found under any `%APPDATA%\Tencent\…\WeChatOCR\<build>\extracted\` root | Install/launch Weixin 4.x once so the OCR plugin is unpacked, or set `WECHAT_OCR_EXE` |
| `未找到微信安装目录（mmmojo_64.dll）` | Registry key missing or no version dir contains `mmmojo_64.dll` | Set `WECHAT_DIR` to the version dir, e.g. `C:\Program Files\Tencent\Weixin\4.0.0.26` |
| `OCR 运行库加载失败：…` | `wcocr.dll` missing or incompatible | Verify `vendor/win32-x64/wcocr.dll` exists, or set `WCOCR_LIB_PATH` |
| `图片不存在：…` | Image path not resolvable | Use an absolute path; check casing and existence |
| `微信 OCR 调用失败` / `微信 OCR 未返回结果` | DLL returned `false` or no callback fired | Confirm `ocrExe`/`wechatDir` versions match (both Weixin 4.x) |

## Development

```bash
npm install
npm run build      # emits dist/ with index.js + vendor + minimal koffi
npm run pack       # build then npm pack
npm test           # smoke test against .probe/native-test/test.png
```

## What's bundled

- `vendor/win32-x64/wcocr.dll` — prebuilt from [`swigger/wechat-ocr`](https://github.com/swigger/wechat-ocr) demo-7 (~155 KB)
- `node_modules/koffi` — minimal subset (`win32_x64` only) emitted into `dist/`

The OCR engine itself (`wxocr.dll` ~24 MB and ML models) is **not** redistributed; it is loaded from the user's existing Weixin install.

## Disclaimer

This is an independent community project. It is **not** affiliated with, endorsed, or sponsored by Tencent or WeChat. "WeChat", "微信", "Weixin", and related marks belong to their respective owners.

This package may load third-party runtime files (the WeChat OCR DLL and ML models) at runtime. Before redistributing or publishing any package that includes such files, ensure you have the necessary rights and comply with applicable licenses, terms of service, and local laws. Use at your own risk.

## License

MIT for this wrapper — see [LICENSE](./LICENSE). The bundled `wcocr.dll` follows its upstream license; the OCR engine (`wxocr.dll`) and ML models are property of Tencent.
