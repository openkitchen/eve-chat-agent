# Capability

## 定义

`Capability` 是一个已发布、受治理的调用单元。其他平台组件可以调用它以取得结果，或执行已明确声明的动作。

它为不同实现形态提供共同的调用边界。调用方不需要知道内部实现是 `Agent`、`Workflow`、`Tool` 还是 `Legacy Adapter`；调用方依据已发布的 `Capability Contract` 调用，并受到一致的 `Identity`、`Authorization`、`Policy`、预算、超时和 `Audit` 控制。

`Capability` 是架构边界，不代表各类内部实现完全相同。

## 为什么需要这个概念

如果没有统一的调用边界，顶层 `Router`、`Agent` 和存量系统通常会通过各自产品的内部约定相互调用。这会形成隐藏权限、不一致的错误处理、无法追踪的嵌套调用，以及 `Chatbot -> Dify Workflow -> Chatbot` 一类问题。

`Capability` 将可调用表面显式化。平台可以对每次调用使用同一组问题：谁在调用、允许做什么、可以使用什么数据、可能产生什么副作用、可以运行多久，以及结果如何被审计。

## Capability 包含什么

每个已发布的 `Capability` 都需要一个 `Capability Contract`。其最小内容如下：

| Contract element | 含义 |
| --- | --- |
| `Capability ID` and version | 稳定身份和版本化的发布目标。 |
| Capability type | `Agent Capability`、`Workflow Capability`、`Tool Capability` 或 `Adapter Capability`。 |
| Purpose | 它设计用于提供的业务结果。 |
| Input contract | 接受的输入结构，包括必需的 `Caller Context` 和业务引用。 |
| Output contract | 结果、错误和异步完成语义。 |
| Allowed data scope | 允许使用的 `Data Domain`、`Knowledge Base Content`、`Structured Business Data`、`Shared Data Contract` 和 `Region` 范围。 |
| Side-effect declaration | 只读、可逆写入、不可逆写入、外部通信或其他风险类型。 |
| Invocation policy | 可调用者、所需 `Authorization`、`Human-in-the-Loop`、预算、超时、重试和幂等性要求。 |
| Delegation policy | 是否可调用其他 `Capability`、允许的目标和 `maxDepth`。 |
| Evidence and audit | 所需的 `Trace`、输入输出摘要、策略决定和结果 provenance。 |

该契约必须可发布、可审查。`Router` 或 `Agent Runtime` 不能从 `Prompt`、实现名称或 vendor-specific endpoint 推断这些信息。

## Capability Types

| Type | 主要职责 | 示例 |
| --- | --- | --- |
| `Agent Capability` | 通过 `LLM` 推理、`Context Assembly` 和受限动作处理开放式请求。 | 回答 HR 政策问题，提供 citation，并在请求不明确时要求澄清。 |
| `Workflow Capability` | 执行明确、确定性、可重试或可补偿的业务步骤。 | 执行经批准的 Finance 计算或 reconciliation 流程，并返回受治理的结果。 |
| `Tool Capability` | 对已声明契约执行一个窄范围的读取、转换或动作。 | 读取 employee record、计算 tax value、导出 report，或提交已校验的 approval request。 |
| `Adapter Capability` | 将 `Legacy Estate` endpoint 包装在共同的契约和控制边界之后。 | 调用已有 `Dify Workflow`，但不暴露 Dify-specific credentials、输入规则或嵌套路由语义。 |

这些类型共享调用边界，但内部仍然不同。尤其是 `Workflow Capability` 不应因为存在 `LLM` 就实现为不受约束的 `Agent Loop`。

## Capability 不是什么

| 不是 Capability 的对象 | 原因 |
| --- | --- |
| `Domain Package` | 一个包可包含多个 `Capability`，以及 `Skill`、`Prompt`、`Policy Overlay`、`Content Package`、`Evaluation` 等资产。它是发布单元，不是单一调用 endpoint。 |
| `Skill` | `Skill` 是可复用的业务指导或 SOP 材料。它可以指导 `Agent` 或 `Workflow`，但不会自动成为 `Router` 可调用入口。 |
| `Prompt` | `Prompt` 提供 instructions；它没有独立的 `Authorization`、input/output contract 或 side-effect declaration。 |
| `Knowledge Base Content` | `Capability` 可以把 content 选入 `Context`，但 `Knowledge Base Content` 本身不执行动作或单独产生业务结果。 |
| 任意 service 或 code module | 内部实现模块不会因存在而自动被发布或可调用。 |
| 用户临时创建的动态链 | 没有经过批准 `Invocation Graph` 的运行时 `Agent/Bot -> Agent/Bot` 链，不是 `Capability` composition。 |

## Interaction Model

```text
Chat UI / Copilot
        |
        v
      Router
        |
        | selects an Entry Capability using Capability Contract + Policy
        v
Agent Capability / Workflow Capability / Tool Capability / Adapter Capability
        |
        | may perform only declared Delegation
        v
Other Capability
```

### Entry Invocation

`Router` 负责 initial routing。它使用可信的 `Caller Context`、`Business Domain`、`Region`、请求意图和 `Policy`，从已发布契约中选择一个 `Entry Capability`。`Router` 不能因为完成路由就获得被选中能力的业务权限。

### Delegation

已调用的 `Capability` 只能通过已声明的 `Delegation` 调用另一个 `Capability`。`Invocation Graph` 必须允许这条边。平台至少强制执行：

- 受限传播的 `Identity Context` 和 least-privilege delegation；
- 允许的 target capability 与 input contract validation；
- `maxDepth`、loop detection、预算、超时、取消和失败语义；
- side-effect 检查和 `Human-in-the-Loop` 要求；
- 一条 end-to-end `Trace`，并保留每一跳的 audit record。

不允许无约束的递归 `Delegation`。调用方不能通过 `Adapter Capability` 绕过调用图，重新建立存量嵌套调用链。

## 示例

### HR Policy Question

`HR Policy Assistant` 是一个 `Agent Capability`。其契约允许通过 HR `Knowledge Base System` 执行 `Authorized Retrieval`，并返回带 citation 的回答。它不写入 HR system、不执行 payroll calculation，也不任意路由至其他 chatbot。

### Finance Calculation Used by HR

`Finance Eligibility Calculation` 可根据复杂度属于 `Workflow Capability` 或 `Tool Capability`：多步骤、受治理的过程使用前者；窄范围确定性计算使用后者。HR `Agent Capability` 通过 `Shared Data Contract` 调用它；HR agent 获得批准的结果和 provenance，而不是对 Finance storage 的不受限访问。

### Existing Dify Workflow

已有 Dify workflow 可被公开为 `Adapter Capability`。adapter 校验输入、传递 short-lived delegated identity、应用超时和 `Audit Policy`，并规范化输出。Dify 本身不再是新平台中的 first-class routing authority。

## 设计影响

- `Capability` 是登记在 `Asset Catalog`、由 `Router` 选择、由 `Invocation Graph` 引用的单元。
- `Domain Package` 安装和版本化 `Capability`，但不复制共享的 `Platform Foundation`。
- 每个 `Capability` 必须声明其是否可使用 `Knowledge Base Content`、`Structured Business Data`、`Shared Data Contract`、`Tool`、`Sandbox` 或外部通信。
- 未来的技术组件可命名为 `Capability Registry`，但该概念不要求此组件名或特定实现。

## Open Questions

1. `Tool Capability` 是否可被外部 `Router` 直接路由，还是只能由其他 `Capability` 调用？
2. 长时 `Workflow Capability` instance 是否需要与短同步调用不同的 `Task Contract`？
3. 第一个生产 `Business Domain` 的 `Capability Contract` 中，哪些字段必须强制要求？
4. 当 `Domain Package` 升级 `Capability` version 时，应如何检查 contract compatibility？

## Concept Delta

### Newly proposed / working terms

| candidate term | type | rationale | intended scope | status |
|---|---|---|---|---|
| `Capability` | `domain` | 为 `Agent`、`Workflow`、`Tool` 和 `Adapter` 提供共同的受治理调用边界。 | `agent-platform` | `proposed` |
| `Capability Contract` | `technical` | 让调用方和平台显式知道 input、output、authorization、side effect 和 delegation 约束。 | `agent-platform` | `proposed` |
| `Agent Capability` / `Workflow Capability` / `Tool Capability` / `Adapter Capability` | `technical` | 区分共同 invocation boundary 下的实现类型与职责。 | `agent-platform` | `proposed` |

### Deprecated aliases touched

| alias | replacement | action |
|---|---|---|
| `Knowledge Asset` | `Knowledge Base Content` | 已替换，详见 `references/concept-decisions/2026-07-19-information-context-vocabulary.md`。 |

### Decision links

- `references/concept-governance.md`
- `references/glossary.md`
- `references/concepts/agent-platform.md`
- `references/concept-decisions/2026-07-19-information-context-vocabulary.md`

### Governance completeness verdict

- `PASS` for registration completeness; terms remain `proposed` pending owner approval.

## Concept Status

`Capability`、`Capability Contract` 和本文的 capability types 均为 `proposed`。本文不定义 API schema，也不选择 workflow、agent、registry 或 adapter 产品。
