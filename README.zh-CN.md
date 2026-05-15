# wechat-ocr-native-win32

[English](./README.md) | 简体中文

Windows x64 下的本地微信（Weixin 4.x）OCR——通过 [koffi](https://koffi.dev) 纯 JS FFI 加载 swigger/wechat-ocr 的 `wcocr.dll`，**无需安装 MSVC / node-gyp**。

> 本项目基于 [`swigger/wechat-ocr`](https://github.com/swigger/wechat-ocr) demo-7 的 `wcocr.dll` 封装。OCR 引擎本体与模型属于腾讯/微信，**不**随本包分发，运行时从用户本机已安装的 Weixin 读取。

## 环境要求

- Windows 10/11 x64
- Node.js ≥ 18
- 本机已安装 Weixin 4.x，需提供：
  - 安装目录下的 `mmmojo_64.dll`（如 `C:\Program Files\Tencent\Weixin\<版本>\`）
  - OCR 插件目录：`%APPDATA%\Tencent\xwechat\XPlugin\Plugins\WeChatOCR\<build>\extracted\`，包含 `wxocr.dll`（约 24 MB）和模型文件

两个路径都会自动定位，也可通过 options 或环境变量手动指定（见 [配置](#配置)）。

## 安装

```bash
npm install @xiaojia5/wechat-ocr-native-win32
```

## 用法

```js
const wcocr = require('@xiaojia5/wechat-ocr-native-win32');

// 最简形式：传入图片路径
const result = wcocr.ocr('C:/path/to/image.png');

console.log(result.engine);          // 'wechat-windows'
console.log(result.text);            // 各行用 '\n' 拼接的纯文本
console.log(result.lines.length);    // 识别到的行数

// 每个文本块的坐标信息在 raw 上：
for (const blk of result.raw.ocr_response || []) {
  console.log(blk.text, blk.left, blk.top, blk.right, blk.bottom);
}

wcocr.stop();
```

也可以传对象，按调用覆盖路径：

```js
const result = wcocr.ocr({
  imagePath: 'C:/path/to/image.png',
  ocrExe:    'C:/.../WeChatOCR/<build>/extracted/wxocr.dll',
  wechatDir: 'C:/Program Files/Tencent/Weixin/4.0.0.26',
  libPath:   'C:/.../wcocr.dll'
});
```

## API

| 函数 | 返回 | 说明 |
|------|------|------|
| `init(opts?)` | `{ ocrExe, wechatDir, libPath }` | 加载 `wcocr.dll`、解析路径并缓存。可省略——`ocr()` 首次调用会自动 init。 |
| `ocr(arg, opts?)` | `{ engine, text, lines, raw }` | 高层调用。`arg` 可为字符串路径或 `{ imagePath, ocrExe?, wechatDir?, libPath? }`。 |
| `ocrJson(arg, opts?)` | `string` | 返回 `wcocr.dll` 原始 JSON 字符串，不做归一化。 |
| `stop()` | `void` | 停止 OCR 进程并释放已加载的库。 |
| `locateOcrExe()` | `string \| null` | 自动从 `%APPDATA%\Tencent\…\WeChatOCR\<build>\extracted\` 发现 `wxocr.dll`。 |
| `locateWechatDir()` | `string \| null` | 读取注册表 `HKCU\Software\Tencent\Weixin /v InstallPath`，找含 `mmmojo_64.dll` 的最高版本子目录。 |

`ocr()` 返回结构：

```ts
{
  engine: 'wechat-windows',
  text:   string,                 // 各行用 '\n' 拼接
  lines:  Array<{ text: string }>,
  raw:    {
    errcode?: number,
    ocr_response?: Array<{
      text: string,
      left: number, top: number, right: number, bottom: number
    }>
  } | string                       // 当 dll 返回非 JSON 时为字符串
}
```

## 配置

### Options

```js
wcocr.init({
  ocrExe:    'C:/.../wxocr.dll',                     // 也可指向 WeChatOCR.exe
  wechatDir: 'C:/Program Files/Tencent/Weixin/4.0.0.26',
  libPath:   'C:/.../wcocr.dll'                      // 覆盖内置 vendor dll
});
```

### 环境变量

| 变量 | 示例 | 作用 |
|------|------|------|
| `WECHAT_OCR_EXE` | `C:\Users\me\AppData\Roaming\Tencent\xwechat\XPlugin\Plugins\WeChatOCR\8011\extracted\wxocr.dll` | 跳过 OCR 引擎自动发现 |
| `WECHAT_DIR` | `C:\Program Files\Tencent\Weixin\4.0.0.26` | 跳过注册表查找 |
| `WCOCR_LIB_PATH` | `D:\custom\wcocr.dll` | 加载自定义 `wcocr.dll`，覆盖 `vendor/win32-x64/wcocr.dll` |

### 自动发现细节

- **OCR 引擎**：扫描以下三个根目录，选最高编号的 build 目录，取 `extracted/wxocr.dll`（找不到时退而求其次取 `extracted/WeChatOCR.exe`）：
  - `%APPDATA%\Tencent\xwechat\XPlugin\Plugins\WeChatOCR\`
  - `%APPDATA%\Tencent\WeChat\XPlugin\Plugins\WeChatOCR\`
  - `%APPDATA%\Tencent\Weixin\XPlugin\Plugins\WeChatOCR\`
- **微信安装目录**：读注册表 `HKCU\Software\Tencent\Weixin /v InstallPath`，再选最新版本号且包含 `mmmojo_64.dll` 的子目录。

## 故障排查

| 报错信息 | 可能原因 | 处置 |
|----------|----------|------|
| `未找到微信 OCR 引擎，请确认已安装 Weixin 4.x` | `%APPDATA%\Tencent\…\WeChatOCR\<build>\extracted\` 下找不到 `wxocr.dll` | 安装并启动一次 Weixin 4.x 让 OCR 插件解压；或设置 `WECHAT_OCR_EXE` |
| `未找到微信安装目录（mmmojo_64.dll）` | 注册表项缺失，或没有版本子目录包含 `mmmojo_64.dll` | 设置 `WECHAT_DIR` 指向版本目录，例如 `C:\Program Files\Tencent\Weixin\4.0.0.26` |
| `OCR 运行库加载失败：…` | `wcocr.dll` 缺失或不兼容 | 检查 `vendor/win32-x64/wcocr.dll` 是否存在；或设置 `WCOCR_LIB_PATH` |
| `图片不存在：…` | 图片路径无法解析 | 使用绝对路径；检查大小写与实际存在 |
| `微信 OCR 调用失败` / `微信 OCR 未返回结果` | DLL 返回 false 或回调未触发 | 确认 `ocrExe` 与 `wechatDir` 版本匹配（同为 Weixin 4.x） |

## 开发

```bash
npm install
npm run build      # 生成 dist/，含 index.js + vendor + 最小化 koffi
npm run pack       # 先 build 再 npm pack
npm test           # 用 .probe/native-test/test.png 跑一次冒烟
```

## 包内文件

- `vendor/win32-x64/wcocr.dll` — 来自 [`swigger/wechat-ocr`](https://github.com/swigger/wechat-ocr) demo-7（约 155 KB）
- `node_modules/koffi` — 仅保留 `win32_x64` 子集，构建时拷贝进 `dist/`

OCR 引擎本体（`wxocr.dll` 约 24 MB）和模型文件**不**随包分发，由用户本机的 Weixin 提供。

## 免责声明

本项目是独立的社区项目，**与腾讯或微信无关联**，也未获得腾讯或微信的认可、赞助或背书。WeChat、微信、Weixin 及相关名称归其各自权利人所有。

本项目可能在运行时加载第三方运行时文件（微信 OCR 动态库与模型）。在使用、分发或发布任何包含这些文件的包之前，请确认你拥有必要的权利，并遵守适用的许可、服务条款和当地法律法规。使用本项目所产生的风险由使用者自行承担。

## 许可

封装代码采用 MIT 许可，详见 [LICENSE](./LICENSE)。打包的 `wcocr.dll` 遵循其上游许可；OCR 引擎（`wxocr.dll`）和模型属腾讯所有。
