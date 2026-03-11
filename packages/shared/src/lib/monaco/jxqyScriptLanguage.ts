/**
 * Jxqy Script Language Definition for Monaco Editor
 * 定义《月影传说》脚本语法高亮和自动补全
 */
import type { editor, IRange, languages, Position } from "monaco-editor";
import { DSL_ONLY_COMMANDS, LUA_API_FUNCTIONS } from "./gameApiDefinitions";

// biome-ignore lint/suspicious/noExplicitAny: Monaco editor type is dynamically loaded
type MonacoType = any;

/**
 * 语言ID
 */
export const JXQY_SCRIPT_LANGUAGE_ID = "jxqy-script";

/**
 * 所有脚本命令定义 — 派生自 gameApiDefinitions.ts，不要在此处手动编辑
 * 如需添加/修改命令，编辑 gameApiDefinitions.ts 中的 LUA_API_FUNCTIONS 或 DSL_ONLY_COMMANDS
 */
export const SCRIPT_COMMANDS = [...LUA_API_FUNCTIONS, ...DSL_ONLY_COMMANDS];
/**
 * 命令名称列表（用于语法高亮）
 */
export const COMMAND_NAMES = SCRIPT_COMMANDS.map((cmd) => cmd.name);

/**
 * 控制流关键字（蓝色高亮）
 * If/Goto/Return 等属于控制流，其余命令作为函数（黄色高亮）
 */
const CONTROL_FLOW_KEYWORDS = new Set(["If", "Goto", "Return", "Assign", "Add", "Sub"]);

/** 控制流关键字名称列表 */
export const KEYWORD_NAMES = COMMAND_NAMES.filter((n) => CONTROL_FLOW_KEYWORDS.has(n));

/** 函数命令名称列表（非控制流） */
export const FUNCTION_NAMES = COMMAND_NAMES.filter((n) => !CONTROL_FLOW_KEYWORDS.has(n));

/**
 * 内置变量
 */
export const BUILTIN_VARIABLES = ["$Event", "$MoneyNum", "$GoodsNum", "$NpcCount", "$PartnerIdx"];

/**
 * 枚举值 - 角色类型
 */
export const ENUM_NPC_KIND = [
  { value: 0, label: "Normal", description: "普通 NPC，站在原地" },
  { value: 1, label: "Fighter", description: "战斗型，启用 AI" },
  { value: 2, label: "Player", description: "玩家控制角色" },
  { value: 3, label: "Follower", description: "跟随者/同伴" },
  { value: 4, label: "GroundAnimal", description: "地面动物" },
  { value: 5, label: "Eventer", description: "事件触发器" },
  { value: 6, label: "AfraidPlayerAnimal", description: "怕玩家的动物" },
  { value: 7, label: "Flyer", description: "飞行敌人" },
];

/**
 * 枚举值 - 关系类型
 */
export const ENUM_RELATION = [
  { value: 0, label: "Friend", description: "友方" },
  { value: 1, label: "Enemy", description: "敌方" },
  { value: 2, label: "Neutral", description: "中立" },
  { value: 3, label: "None", description: "无关系（攻击所有）" },
];

/**
 * 枚举值 - 方向
 */
export const ENUM_DIRECTION = [
  { value: 0, label: "北" },
  { value: 1, label: "东北" },
  { value: 2, label: "东" },
  { value: 3, label: "东南" },
  { value: 4, label: "南" },
  { value: 5, label: "西南" },
  { value: 6, label: "西" },
  { value: 7, label: "西北" },
];

/**
 * 类别颜色映射
 */
export const CATEGORY_COLORS: Record<string, string> = {
  NPC: "#4EC9B0",
  Player: "#DCDCAA",
  Dialog: "#CE9178",
  GameState: "#569CD6",
  Audio: "#C586C0",
  Screen: "#9CDCFE",
  Weather: "#4FC1FF",
  Object: "#B5CEA8",
  Trap: "#D7BA7D",
  Memo: "#F48771",
  Timer: "#D16969",
  Shop: "#B8D7A3",
  Effect: "#C8C8C8",
  Save: "#808080",
  Variable: "#C586C0",
  StatusEffect: "#FF8C00",
  Misc: "#808080",
};

/**
 * 注册 Jxqy Script 语言到 Monaco Editor
 */
export function registerJxqyScriptLanguage(monaco: MonacoType): void {
  // 检查是否已注册
  const languagesList = monaco.languages.getLanguages();
  if (languagesList.some((lang: { id: string }) => lang.id === JXQY_SCRIPT_LANGUAGE_ID)) {
    return;
  }

  // 注册语言
  monaco.languages.register({
    id: JXQY_SCRIPT_LANGUAGE_ID,
    extensions: [".txt"],
    aliases: ["Jxqy Script", "jxqy"],
  });

  // 设置语言配置（括号匹配、注释等）
  monaco.languages.setLanguageConfiguration(JXQY_SCRIPT_LANGUAGE_ID, {
    comments: {
      lineComment: "//",
    },
    brackets: [["(", ")"]],
    autoClosingPairs: [
      { open: "(", close: ")" },
      { open: '"', close: '"' },
    ],
    surroundingPairs: [
      { open: "(", close: ")" },
      { open: '"', close: '"' },
    ],
  });

  // 设置语法高亮 (Monarch tokenizer)
  monaco.languages.setMonarchTokensProvider(JXQY_SCRIPT_LANGUAGE_ID, {
    // 控制流关键字（蓝色）
    keywords: KEYWORD_NAMES,
    // 函数命令（黄色）
    functions: FUNCTION_NAMES,

    tokenizer: {
      root: [
        // 注释
        [/\/\/.*$/, "comment"],

        // 标签定义 @LabelName:
        [/@[a-zA-Z_][a-zA-Z0-9_]*:/, "type.identifier"],

        // 标签引用 @LabelName
        [/@[a-zA-Z_][a-zA-Z0-9_]*/, "type"],

        // 变量 $VarName
        [/\$[a-zA-Z_][a-zA-Z0-9_]*/, "variable"],

        // 关键字 & 函数命令
        [
          /[a-zA-Z_][a-zA-Z0-9_]*/,
          {
            cases: {
              "@keywords": "keyword",
              "@functions": "function",
              "@default": "identifier",
            },
          },
        ],

        // 字符串
        [/"[^"]*"/, "string"],

        // 数字
        [/-?\d+/, "number"],

        // 运算符
        [/[<>=!]+/, "operator"],
        [/[<>]=?|[!=]=|<>/, "operator"],

        // 分隔符
        [/[(),;]/, "delimiter"],

        // 空白
        [/\s+/, "white"],
      ],
    },
  });

  // 注册自动补全提供者
  monaco.languages.registerCompletionItemProvider(JXQY_SCRIPT_LANGUAGE_ID, {
    triggerCharacters: ["@", "$", "("],

    provideCompletionItems: (model: editor.ITextModel, position: Position) => {
      const word = model.getWordUntilPosition(position);
      const range: IRange = {
        startLineNumber: position.lineNumber,
        endLineNumber: position.lineNumber,
        startColumn: word.startColumn,
        endColumn: word.endColumn,
      };

      const lineContent = model.getLineContent(position.lineNumber);
      const textBeforeCursor = lineContent.substring(0, position.column - 1);

      const suggestions: languages.CompletionItem[] = [];

      // 检测是否在输入标签引用
      if (textBeforeCursor.endsWith("@") || textBeforeCursor.match(/@\w*$/)) {
        // 搜索文档中所有标签定义
        const content = model.getValue();
        const labelMatches = content.matchAll(/@([a-zA-Z_][a-zA-Z0-9_]*):/g);
        const labels = new Set<string>();
        for (const match of labelMatches) {
          labels.add(match[1]);
        }
        for (const label of labels) {
          suggestions.push({
            label: `@${label}`,
            kind: monaco.languages.CompletionItemKind.Reference,
            insertText: label,
            range,
            detail: "标签跳转",
          });
        }
        return { suggestions };
      }

      // 检测是否在输入变量
      if (textBeforeCursor.endsWith("$") || textBeforeCursor.match(/\$\w*$/)) {
        // 内置变量
        for (const v of BUILTIN_VARIABLES) {
          suggestions.push({
            label: v,
            kind: monaco.languages.CompletionItemKind.Variable,
            insertText: v.slice(1), // 去掉 $
            range,
            detail: "内置变量",
          });
        }
        // 搜索文档中已使用的变量
        const content = model.getValue();
        const varMatches = content.matchAll(/\$([a-zA-Z_][a-zA-Z0-9_]*)/g);
        const vars = new Set<string>();
        for (const match of varMatches) {
          vars.add(match[1]);
        }
        for (const v of vars) {
          if (!BUILTIN_VARIABLES.includes(`$${v}`)) {
            suggestions.push({
              label: `$${v}`,
              kind: monaco.languages.CompletionItemKind.Variable,
              insertText: v,
              range,
              detail: "自定义变量",
            });
          }
        }
        return { suggestions };
      }

      // 默认：命令补全
      for (const cmd of SCRIPT_COMMANDS) {
        const blockingNote = cmd.blocking ? " ⏳阻塞" : "";
        suggestions.push({
          label: cmd.name,
          kind: monaco.languages.CompletionItemKind.Function,
          insertText: `${cmd.name}${cmd.signature};`,
          insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
          range,
          detail: `[${cmd.category}]${blockingNote}`,
          documentation: {
            value: `**${cmd.name}**${cmd.signature}\n\n${cmd.description}${blockingNote ? "\n\n⏳ 此命令会阻塞脚本执行" : ""}`,
          },
        });
      }

      return { suggestions };
    },
  });

  // 注册悬停提示提供者
  monaco.languages.registerHoverProvider(JXQY_SCRIPT_LANGUAGE_ID, {
    provideHover: (model: editor.ITextModel, position: Position) => {
      const word = model.getWordAtPosition(position);
      if (!word) return null;

      const cmd = SCRIPT_COMMANDS.find((c) => c.name.toLowerCase() === word.word.toLowerCase());
      if (!cmd) return null;

      const blockingNote = cmd.blocking ? "\n\n⏳ **此命令会阻塞脚本执行**" : "";
      return {
        range: new monaco.Range(
          position.lineNumber,
          word.startColumn,
          position.lineNumber,
          word.endColumn
        ),
        contents: [
          { value: `**${cmd.name}**\`${cmd.signature}\`` },
          { value: `**分类**: ${cmd.category}` },
          { value: cmd.description + blockingNote },
        ],
      };
    },
  });

  // 注册函数签名帮助
  monaco.languages.registerSignatureHelpProvider(JXQY_SCRIPT_LANGUAGE_ID, {
    signatureHelpTriggerCharacters: ["(", ","],
    provideSignatureHelp: (model: editor.ITextModel, position: Position) => {
      const lineContent = model.getLineContent(position.lineNumber);
      const textBeforeCursor = lineContent.substring(0, position.column - 1);

      // 查找最近的命令名
      const match = textBeforeCursor.match(/(\w+)\s*\([^)]*$/);
      if (!match) return null;

      const cmdName = match[1];
      const cmd = SCRIPT_COMMANDS.find((c) => c.name.toLowerCase() === cmdName.toLowerCase());
      if (!cmd) return null;

      // 计算当前参数索引
      const paramsText = textBeforeCursor.substring(textBeforeCursor.lastIndexOf("(") + 1);
      const commaCount = (paramsText.match(/,/g) || []).length;

      return {
        value: {
          signatures: [
            {
              label: `${cmd.name}${cmd.signature}`,
              documentation: cmd.description,
              parameters: cmd.signature
                .replace(/[()]/g, "")
                .split(",")
                .map((p) => ({
                  label: p.trim(),
                  documentation: "",
                })),
            },
          ],
          activeSignature: 0,
          activeParameter: commaCount,
        },
        dispose: () => {},
      };
    },
  });
}

/**
 * 定义自定义主题（可选）
 */
export function defineJxqyScriptTheme(monaco: MonacoType): void {
  monaco.editor.defineTheme("jxqy-script-theme", {
    base: "vs-dark",
    inherit: true,
    rules: [
      { token: "comment", foreground: "6A9955", fontStyle: "italic" },
      { token: "keyword", foreground: "C586C0" },
      { token: "function", foreground: "DCDCAA" },
      { token: "type.identifier", foreground: "4EC9B0" },
      { token: "type", foreground: "4EC9B0" },
      { token: "variable", foreground: "9CDCFE" },
      { token: "string", foreground: "CE9178" },
      { token: "number", foreground: "B5CEA8" },
      { token: "operator", foreground: "D4D4D4" },
      { token: "delimiter", foreground: "D4D4D4" },
    ],
    colors: {},
  });
}
