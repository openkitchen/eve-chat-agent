# Information and Context Vocabulary

## Status

`proposed-working-vocabulary`

## Context

企业 Agent 需要从 Wiki、SharePoint、business system、uploaded file、public web、Skill、Memory、Preference 和当前 Task 中系统性获取信息。此前使用过宽泛的 `Knowledge` / `Knowledge Asset` 表达，无法区分 KBS content、structured business data、procedural guidance 和 runtime state。

## Previous Approach

使用 `Knowledge` 或 `Knowledge Asset` 作为跨来源的信息统一概念。该方式把平台管理的非结构化内容、HR/Finance 等结构化事实、`Skill`、`Memory` 和 `Temporary Data` 混在一起。

## Problem / Failure Modes

- 无法判断哪些信息由 `Knowledge Base System` 管理，哪些必须通过 `Tool`、`Connector` 或 `Shared Data Contract` 获取。
- 不同 owner、freshness、authorization 和 authority 的材料被错误地放进同一个 priority 体系。
- `Skill` 可能被误认为普通 document，或被误认为可任意调用的 `Capability`。
- `Memory`、`Preference` 和 uploaded content 可能被错误地当作组织级事实。
- `LLM Context` 的来源与冲突无法系统审计。

## Alternatives Considered

### Keep `Knowledge` as the universal platform concept

Rejected because it is too broad and encourages a platform-owned universal knowledge store.

### Adopt a strict `Data / Information / Knowledge` hierarchy

Partially useful as explanatory vocabulary, but not sufficient as a system model: the same source can be temporary content, KBS content, a Skill reference, or runtime evidence at different lifecycle stages.

### Use `Information` as the umbrella and classify Context Material by access path and authority

Selected as the working direction. It lets the platform distinguish `Knowledge Base Content`, `Structured Business Data`, `Procedural Knowledge`, `Temporary Data`, `Memory`, and `Personalization Preference` without claiming they share the same owner or lifecycle.

## Decision

1. Do not use standalone `Knowledge` as a platform system entity.
2. Use `Information` as a broad explanatory term only.
3. Use `Knowledge Base System` for the platform capability that connects, indexes, federates, retrieves, cites, and governs `Knowledge Base Content`.
4. Use `Structured Business Data` for current facts and calculation inputs from business systems; access them through `Tool`, `Connector`, `Workflow`, or `Shared Data Contract`.
5. Use `Procedural Knowledge` as an explanatory category for how-to rules; use `Skill` as its governed, publishable representation.
6. Keep `Temporary Data`, `Memory`, `Personalization Preference`, `Context Material`, and `LLM Context` as separate terms with separate scope and lifecycle.
7. Deprecate `Knowledge Asset` as a generic platform term. Migrate each occurrence to `Knowledge Base Content` or a more specific subtype.

## Rationale and Tradeoffs

This model follows the emerging `Context Engineering` practice of curating information for each model call, while preserving enterprise differences between reference content, business data, procedural guidance, memory, and preferences. It adds more labels than a single `Knowledge` bucket, but makes ownership, authorization, freshness, conflict priority, and audit behavior explicit.

## Scope / Non-goals / Open Items

- In scope: architecture vocabulary, information-to-component mapping, `Context Assembly`, source authority, conflict handling, and lifecycle boundaries.
- Non-goal: choosing a search engine, vector store, knowledge graph, memory framework, or workflow product.
- Open item: approve the final owner for the `agent-platform` context and decide whether `Procedural Knowledge` should remain explanatory or become a registered domain concept.

## Compatibility Notes

Existing documents may temporarily contain `Knowledge Asset`. New documents must use the more specific terms. Existing `Shared Knowledge Asset` references should migrate to `Shared Knowledge Base Content` when they describe KBS-managed content, or to `Shared Data Contract` when they describe structured facts and calculations.

## Validation

- Anthropic, [Effective context engineering for AI agents](https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents), treats context as curated information beyond `Prompt`, including external data, history, tools, and memory.
- LangGraph, [Memory overview](https://docs.langchain.com/oss/python/concepts/memory), separates short-term thread memory, long-term memory, semantic facts, episodic experience, and procedural instructions.
- Microsoft, [RAG overview](https://learn.microsoft.com/en-us/azure/search/retrieval-augmented-generation-overview), treats retrieval as grounding model responses in content rather than replacing business systems of record.
- IBM, [Knowledge Management](https://www.ibm.com/think/topics/knowledge-management), defines knowledge management as creating, storing, using, and sharing knowledge in an organization, not as one universal product-owned database.
