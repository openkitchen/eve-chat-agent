# Agent Platform Context Map

## Context

- Name: `agent-platform`
- Scope: 企业 Agent 平台的业务范围、信息分类、能力调用、知识接入、Context Assembly、治理和区域部署边界。
- Primary docs: `architecture/background.md`, `architecture/concept-map.md`, `architecture/concepts/README.md`, `architecture/concepts/capability.md`, `architecture/concepts/information-knowledge-base-and-context.md`

## Canonical terms used in this context

当前没有已批准的 canonical terms。下列术语已在 glossary 中登记为 `proposed`，供架构讨论使用：

| term | meaning in this context | source |
|---|---|---|
| `Capability` | 带发布契约、可受治理调用的能力单元。 | `architecture/concepts/capability.md` |
| `Information` | 所有可能对 `Agentic Task` 有用的信息上位分类。 | `architecture/concepts/information-knowledge-base-and-context.md` |
| `Knowledge Base System` | 接入、索引或 federation `Knowledge Base Content` 的平台能力。 | `architecture/concepts/information-knowledge-base-and-context.md` |
| `Knowledge Base Content` | KBS 管理或引用的非结构化 reference content。 | `architecture/concepts/information-knowledge-base-and-context.md` |
| `Structured Business Data` | 由 system of record 提供的结构化业务事实和计算输入。 | `architecture/concepts/information-knowledge-base-and-context.md` |
| `Procedural Knowledge` | 描述如何完成业务工作的规则、步骤和判断方式。 | `architecture/concepts/information-knowledge-base-and-context.md` |
| `Skill` | `Procedural Knowledge` 的受治理发布形态。 | `architecture/concepts/information-knowledge-base-and-context.md` |
| `Temporary Data` | task/session scope 的输入、结果和产物。 | `architecture/concepts/information-knowledge-base-and-context.md` |
| `Memory` | 有明确 scope 与 lifecycle 的历史交互或执行状态。 | `architecture/concepts/information-knowledge-base-and-context.md` |
| `Personalization Preference` | user/organization scope 的表达和行为偏好。 | `architecture/concepts/information-knowledge-base-and-context.md` |
| `Context Material` | 可能进入一次 model call 的材料。 | `architecture/concepts/information-knowledge-base-and-context.md` |
| `LLM Context` | 一次 model invocation 的最终有界、有序输入。 | `architecture/concepts/information-knowledge-base-and-context.md` |

## Local aliases / working terms

| local term | maps to | status | note |
|---|---|---|---|
| broad `Knowledge` | `Information` | `deprecated` | 不再作为平台统一系统实体。 |
| `Knowledge Asset` | `Knowledge Base Content` or a specific information subtype | `deprecated` | 必须按实际内容类型迁移，不能简单全量替换为一个新泛化词。 |
| `KBS` | `Knowledge Base System` | `proposed` | 仅作为可能的缩写，正式文档优先使用完整名称。 |

## Boundaries

- In scope: 信息分类、KBS 接入、structured data access、`Skill`、`Memory`、`Context Assembly`、`Capability` 调用和治理边界。
- Out of scope: 具体 search engine、vector store、memory framework、workflow product、模型供应商和部署编排工具的选型。
- Potential conflict: `Skill` 与 `Procedural Memory` 可能都包含操作规则；前者是已审核发布资产，后者是运行时或历史交互产生的 memory，不应混用。
- Potential conflict: `Knowledge Base Content` 与 `Structured Business Data` 都可能回答问题，但 authoritative source、freshness 和 access path 不同。

## Decision links

- `references/concept-decisions/2026-07-19-information-context-vocabulary.md`
- `references/concept-governance.md`
- `references/glossary.md`
