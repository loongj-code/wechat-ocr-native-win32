# wechat-ocr-native-win32

Local WeChat (Weixin 4.x) OCR for Windows x64 — wraps swigger/wechat-ocr's `wcocr.dll` via koffi (pure-JS FFI, no MSVC required).

## Requirements

- Windows 10/11 x64
- Node.js ≥ 18
- WeChat / Weixin 4.x installed (provides `mmmojo_64.dll` + the OCR plugin under `%APPDATA%\Tencent\xwechat\XPlugin\Plugins\WeChatOCR\<build>\extracted\`)

The package auto-locates both paths from the registry / `%APPDATA%`. Override with options or env vars `WECHAT_OCR_EXE` / `WECHAT_DIR`.

## Usage

```js
const wcocr = require('wechat-ocr-native-win32');

const result = wcocr.ocr('C:/path/to/image.png');
console.log(result.errcode, result.ocr_response.length);
for (const blk of result.ocr_response) {
  console.log(blk.text, blk.left, blk.top, blk.right, blk.bottom);
}
wcocr.stop();
```

API: `init(opts?)`, `ocr(imagePath, opts?)`, `ocrJson(imagePath, opts?)`, `stop()`,
`locateOcrExe()`, `locateWechatDir()`.

`opts`: `{ ocrExe, wechatDir, libPath }` — all optional.

## What's bundled

- `vendor/win32-x64/wcocr.dll` — prebuilt from [swigger/wechat-ocr](https://github.com/swigger/wechat-ocr) demo-7 (155 KB).

The OCR engine itself (`wxocr.dll` ~24 MB and ML models) is **not** redistributed; it's loaded from the user's existing WeChat install.

## License

MIT for this wrapper. The bundled `wcocr.dll` follows its upstream license; the OCR engine and models are property of Tencent.
