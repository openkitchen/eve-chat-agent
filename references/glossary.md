# Glossary

Global concept registry for the enterprise Agent platform.

## Status

- `canonical`：已批准且可跨文档、API 和实现复用。
- `proposed`：候选工作术语，等待 owner 决策。
- `deprecated`：历史名称或待迁移别名，必须有目标术语。

## Terms

| term | status | layer | context | aliases | definition | evidence | owner | decision |
|---|---|---|---|---|---|---|---|---|
| `Information` | `proposed` | `domain` | `agent-platform` | broad knowledge | 所有可能对 `Agentic Task` 有用的事实、内容、规则、状态和偏好。 | `architecture/concepts/information-knowledge-base-and-context.md` | `Architecture Working Group` | `references/concept-decisions/2026-07-19-information-context-vocabulary.md` |
| `Data` | `proposed` | `domain` | `agent-platform` | — | 可以被记录、读取、传输或计算的事实和内容，包括 structured 与 unstructured subtype。 | `architecture/concepts/information-knowledge-base-and-context.md` | `Architecture Working Group` | `references/concept-decisions/2026-07-19-information-context-vocabulary.md` |
| `Structured Business Data` | `proposed` | `domain` | `agent-platform` | operational data | 来自 business system of record 的结构化业务事实和计算输入。 | `architecture/concepts/information-knowledge-base-and-context.md` | `Architecture Working Group` | `references/concept-decisions/2026-07-19-information-context-vocabulary.md` |
| `Knowledge Base System` | `proposed` | `technical` | `agent-platform` | KBS | 接入、索引或 federation `Knowledge Base Content` 并提供 `Authorized Retrieval` 的平台能力。 | `architecture/concepts/information-knowledge-base-and-context.md` | `Architecture Working Group` | `references/concept-decisions/2026-07-19-information-context-vocabulary.md` |
| `Knowledge Base Content` | `proposed` | `domain` | `agent-platform` | reference content | 由 `Knowledge Base System` 管理或引用的非结构化组织内容。 | `architecture/concepts/information-knowledge-base-and-context.md` | `Architecture Working Group` | `references/concept-decisions/2026-07-19-information-context-vocabulary.md` |
| `Procedural Knowledge` | `proposed` | `domain` | `agent-platform` | operational knowledge | 描述如何完成一类业务工作的规则、步骤和判断方式。 | `architecture/concepts/information-knowledge-base-and-context.md` | `Architecture Working Group` | `references/concept-decisions/2026-07-19-information-context-vocabulary.md` |
| `Skill` | `proposed` | `process` | `agent-platform` | SOP skill | `Procedural Knowledge` 的可发布、可测试和可版本化表达。 | `architecture/concepts/information-knowledge-base-and-context.md`, `architecture/concepts/capability.md` | `Architecture Working Group` | `references/concept-decisions/2026-07-19-information-context-vocabulary.md` |
| `Temporary Data` | `proposed` | `domain` | `agent-platform` | task data | 当前 `Task` 或 `Session` 的输入、tool result、上传文件和 generated artifact。 | `architecture/concepts/information-knowledge-base-and-context.md` | `Architecture Working Group` | `references/concept-decisions/2026-07-19-information-context-vocabulary.md` |
| `Memory` | `proposed` | `domain` | `agent-platform` | short-term/long-term memory | 从历史交互或执行过程保留下来的、具有明确 scope 和 lifecycle 的状态信息。 | `architecture/concepts/information-knowledge-base-and-context.md` | `Architecture Working Group` | `references/concept-decisions/2026-07-19-information-context-vocabulary.md` |
| `Personalization Preference` | `proposed` | `domain` | `agent-platform` | user preference | user 或 organization scope 的表达和行为偏好。 | `architecture/concepts/information-knowledge-base-and-context.md` | `Architecture Working Group` | `references/concept-decisions/2026-07-19-information-context-vocabulary.md` |
| `Context Material` | `proposed` | `technical` | `agent-platform` | context input | 可能被 `Context Assembly` 选入一次 model call 的材料。 | `architecture/concepts/information-knowledge-base-and-context.md` | `Architecture Working Group` | `references/concept-decisions/2026-07-19-information-context-vocabulary.md` |
| `LLM Context` | `proposed` | `technical` | `agent-platform` | context window payload | 最终传入一次 model invocation 的有界、有序输入。 | `architecture/concepts/information-knowledge-base-and-context.md` | `Architecture Working Group` | `references/concept-decisions/2026-07-19-information-context-vocabulary.md` |
| `Capability` | `proposed` | `domain` | `agent-platform` | — | 带发布契约、可受治理调用的业务能力单元。 | `architecture/concepts/capability.md` | `Architecture Working Group` | `references/concept-decisions/2026-07-19-information-context-vocabulary.md` |
| `Capability Contract` | `proposed` | `technical` | `agent-platform` | invocation contract | 描述 `Capability` 的输入、输出、权限、数据范围、副作用和调用约束的发布契约。 | `architecture/concepts/capability.md` | `Architecture Working Group` | `references/concept-decisions/2026-07-19-information-context-vocabulary.md` |

## Deprecated Terms

| term | status | replacement | reason |
|---|---|---|---|
| `Knowledge Asset` | `deprecated` | `Knowledge Base Content` or the more specific `Structured Business Data`, `Skill`, `Memory`, or `Temporary Data` | 过于宽泛，混淆平台管理内容、业务数据、procedural knowledge 和 runtime state。 |
| standalone `Knowledge` as platform entity | `deprecated` | `Information` plus a specific subtype | 不把广义 Knowledge 当作平台统一拥有的系统实体。 |
