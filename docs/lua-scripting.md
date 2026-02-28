# Lua 脚本支持设计方案

## 现有脚本系统架构

当前脚本系统分 5 层：

```
.txt 文件  →  parser.ts (词法分析)  →  ScriptData (AST)
                                           ↓
ScriptExecutor (逐行解释)  ←→  CommandRegistry (182条命令)
                ↓
          GameAPI (引擎接口)  ←→  BlockingResolver (帧驱动阻塞)
```

`GameAPI`（`packages/engine/src/script/api/game-api.ts`）注释第一行即写明：
> *"Structured interface for all script engines (custom, JS, Lua)"*

说明原始设计已预留了 Lua 扩展点，**底层基础设施完全不需要改动**。

---

## 核心挑战

### 1. 阻塞机制（最难）

现有系统用 JS `async/await`，`await dialog.show("你好")` 天然挂起 Promise 链，由 `BlockingResolver.waitForEvent()` 驱动。

Lua 是同步语言，没有 `await`。必须用 **Lua 协程（coroutine）** 桥接：

```
JS: await thread.resume()
→ Lua 跑到 coroutine.yield("talk", 1, "你好")
→ JS: resume() 返回 ["talk", 1, "你好"]
→ JS: await api.dialog.show("你好", 1)   ← 挂到 BlockingResolver
→ 对话关闭，resolver resolve
→ JS: await thread.resume()             ← 把结果传回 Lua
→ Lua: 从 yield 之后继续
```

### 2. Lua 运行时选型

浏览器中需要 WASM 编译的 Lua：

| 方案 | 说明 | 推荐 |
|------|------|------|
| **`wasmoon`** | Lua 5.4 WASM，支持 `LuaThread` 协程 API，在 Worker 中运行 | ✅ 推荐 |
| `fengari` | 纯 JS Lua 5.3，无需 WASM 但性能较差 | 备选 |

### 3. API 绑定层

需要把整个 `GameAPI`（~330 行接口）的所有方法暴露为 Lua 全局函数/表。

---

## 协程-Promise 桥接机制

### Lua 侧（引擎注入，用户不感知）

```lua
-- 引擎自动注入的阻塞包装函数，对脚本编写者透明
local function talk(npc, text)
    coroutine.yield("talk", npc, text)
end

local function loadMap(mapName, x, y)
    coroutine.yield("loadMap", mapName, x, y)
end

local function choose(msg, optA, optB)
    return coroutine.yield("choose", msg, optA, optB)
    -- JS 把用户选择结果通过 resume(returnValue) 传回
end

-- 用户编写的脚本（与现有 DSL 等价）
talk(1, "你好!")
local choice = choose("要买东西吗?", "买", "不买")
if choice == 1 then
    loadMap("shop", 10, 20)
end
```

### JS 侧核心驱动循环

```typescript
class LuaExecutor implements IScriptExecutor {
  private async driveCoroutine(thread: LuaThread): Promise<void> {
    let yieldValues = await thread.resume(); // 第一次启动

    while (thread.status === LuaThreadStatus.Yielded) {
      const [opName, ...args] = yieldValues;
      let returnValue: unknown = undefined;

      switch (opName) {
        case "talk":
          // 复用现有 BlockingResolver 基础设施，完全不改现有代码
          await this.api.dialog.show(args[1] as string, args[0] as number);
          break;

        case "loadMap":
          await this.api.map.load(args[0] as string);
          break;

        case "choose":
          returnValue = await this.api.dialog.showSelection(
            args[0] as string,
            args[1] as string,
            args[2] as string
          );
          break;
      }

      // 把结果传回 Lua 协程（choose 的选择结果就这样回去的）
      yieldValues = await thread.resume(returnValue);
    }
  }
}
```

### loadMap 的特殊处理

`loadMap` 切图后当前脚本上下文会被销毁（与现有 DSL 行为一致）。
`yield("loadMap", ...)` 后，JS 执行地图切换，新地图启动新的执行器实例，
老的 `LuaThread` 直接丢弃，**不需要 resume**。

---

## 改动清单（全部增量，不改现有代码）

| 步骤 | 工作内容 | 影响范围 |
|------|---------|---------|
| 1 | 提取 `IScriptExecutor` 接口（`runScript / queueScript / update / isRunning` 等）| 新增接口文件 |
| 2 | 现有 `ScriptExecutor` 加上 `implements IScriptExecutor` | 1 行改动 |
| 3 | 安装 `wasmoon`，创建 `LuaExecutor` 类 `implements IScriptExecutor` | 新文件 |
| 4 | 创建 Lua API 绑定层（把 `GameAPI` 映射为 Lua table） | 新文件 |
| 5 | 实现协程-Promise 桥（yield opName dispatch → `BlockingResolver`） | 新文件 |
| 6 | `GameManager` 按文件扩展名路由到对应 executor（`.txt` → DSL，`.lua` → Lua）| 小改动 |

---

## DSL vs Lua 对照

| 特性 | 现有 DSL | Lua |
|------|---------|-----|
| 阻塞挂起方式 | `async/await` | `coroutine.yield(opName, ...args)` |
| 阻塞底层驱动 | `BlockingResolver.waitForEvent()` | JS `await` 后再 `thread.resume()` |
| 返回值传递 | Promise resolve | `thread.resume(returnValue)` 传回 Lua |
| 并行脚本 | `ParallelScriptRunner` | 独立 `LuaThread` 实例 |
| 变量系统 | `$VarName` 全局 Map | Lua 全局变量 + `variables.get/set` API |

---

## 估算工作量

- **代码量**：约 500–800 行新代码，**零改动现有系统**
- **主要瓶颈**：`yield` opName dispatch 层的完整覆盖（182 条命令全部映射）
- **风险点**：`wasmoon` 在多实例并发（并行脚本）场景下的稳定性需实测
