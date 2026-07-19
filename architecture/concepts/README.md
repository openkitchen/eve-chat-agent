# Architecture Concepts

## 目的

本目录定义企业 Agent 平台的关键概念和技术组件。每份文档回答四个问题：

1. 该概念是什么。
2. 该概念不是什么。
3. 它的主要职责和边界是什么。
4. 它如何与其他概念交互。

概念名称使用英文，正文使用中文解释其架构含义。文档保持 vendor-neutral，除非特别说明，否则不代表具体实现选型或 `Deployment Topology`。

## Concept Map

| Concept | 角色 | 文档 |
| --- | --- | --- |
| `Capability` | 一个带发布契约、可受治理调用的业务能力单元。 | [capability.md](capability.md) |
| `Information, Knowledge Base System, and Context` | 将 `Information` 映射为 `Knowledge Base Content`、`Structured Business Data`、`Skill`、`Temporary Data`、`Memory`、`Personalization Preference` 和一次 `LLM Context` 的输入。 | [information-knowledge-base-and-context.md](information-knowledge-base-and-context.md) |
| `Domain Package` | 将领域 `Capability` 与创作资产安装到共享 `Platform Foundation` 的版本化包。 | Planned |
| `Agent` | 使用 `Instructions`、`Context` 和允许动作处理开放式任务的 `LLM` 驱动能力。 | Planned |
| `Workflow` | 承担显式业务步骤的确定性或受控长时能力。 | Planned |
| `Tool` and `Connector` | 对外部系统进行受限读取或动作的契约。 | Planned |
| `Router` and `Delegation` | 初始路由和已声明的跨能力调用。 | Planned |
| `Control Plane` | 负责 `Asset Catalog`、`Policy`、`Package Release`、治理和生命周期管理。 | Planned |
| `Regional Deployment` | 可承载多个 `Business Domain` 的运行时和 `Data Residency` 边界。 | Planned |

## 阅读顺序

先阅读 `Capability`，再阅读 `Information, Knowledge Base System, and Context`。它们共同定义后续组件都必须遵守的两个边界：

- 什么可以被调用，以及调用时必须遵守什么契约；
- 什么可以进入 `LLM Context`，为什么可进入，以及它具有什么权威性。

## 状态

本目录中的所有术语均为 `proposed`。在正式的概念治理材料建立并批准前，不得将它们当作 canonical 的 API、schema 或产品术语。
