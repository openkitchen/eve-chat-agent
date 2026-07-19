# Concept Governance

## 目的

本项目用 Concept Governance 管理架构、设计、API 和实现中的术语变化，避免同一个概念出现多个名称，或同一个名称在不同上下文中表达不同含义。

## Governance Artifacts

- `references/glossary.md`：全局术语注册表。
- `references/concepts/<context>.md`：限定上下文中的含义、边界和 local working terms。
- `references/concept-decisions/<date>-<topic>.md`：新增、重命名、拆分或合并概念的决策记录。
- `references/concept-delta-template.md`：设计文档中的 Concept Delta 模板。

## 规则

1. 新术语默认登记为 `proposed`，不能直接视为 canonical。
2. 新增、重命名、拆分或合并概念时，必须同时更新 glossary、相关 context map 和 decision record。
3. 设计文档必须包含 Concept Delta，并链接相关治理文件。
4. 技术实现名称不自动成为业务概念；需要明确其属于 `domain`、`process` 或 `technical` layer。
5. 评审只验证是否遵循已登记的术语，不在评审意见中临时创造新的 canonical 概念。

## Roles

- `Architecture Working Group`：当前 proposed terms 的 owner；正式 owner 待项目确认。
- 文档作者：提交 Concept Delta、证据和未决问题。
- 实现作者：使用已批准或已登记的术语，不在代码中静默引入别名。

## Status

当前架构术语基线已建立，但主要术语仍为 `proposed`。在 owner 完成冲突检查和决策确认前，治理状态为 `BLOCKED`。
