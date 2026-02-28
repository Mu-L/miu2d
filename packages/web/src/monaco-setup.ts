/**
 * Monaco Editor 本地化配置
 *
 * 使用本地安装的 monaco-editor（来自 node_modules），
 * 避免运行时从 CDN 加载（默认会请求 cdn.jsdelivr.net）。
 *
 * 必须在任何 Monaco Editor 实例创建之前导入此文件。
 */

import { loader } from "@monaco-editor/react";
import * as monaco from "monaco-editor";

// Vite worker 导入 —— 构建时自动打包为独立 chunk
import editorWorker from "monaco-editor/esm/vs/editor/editor.worker?worker";
import jsonWorker from "monaco-editor/esm/vs/language/json/json.worker?worker";
import cssWorker from "monaco-editor/esm/vs/language/css/css.worker?worker";
import htmlWorker from "monaco-editor/esm/vs/language/html/html.worker?worker";
import tsWorker from "monaco-editor/esm/vs/language/typescript/ts.worker?worker";

// 配置 Monaco Worker 环境，让编辑器能正确启动 Web Worker
// 各语言的 Worker 文件已由 Vite 打包为本地资源
(self as Window & { MonacoEnvironment?: { getWorker: (workerId: string, label: string) => Worker } }).MonacoEnvironment = {
  getWorker(_workerId: string, label: string): Worker {
    switch (label) {
      case "json":
        return new jsonWorker();
      case "css":
      case "scss":
      case "less":
        return new cssWorker();
      case "html":
      case "handlebars":
      case "razor":
        return new htmlWorker();
      case "typescript":
      case "javascript":
        return new tsWorker();
      default:
        return new editorWorker();
    }
  },
};

// 告知 @monaco-editor/react 使用本地 monaco 实例，而非从 CDN 拉取
loader.config({ monaco });
