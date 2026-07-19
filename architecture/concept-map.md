# 企业自主可控 Agent 平台：候选概念地图

## 目的与使用方式

本文是整体方案的第一轮概念调研结果。目标是先识别企业 Agent 平台需要承担的稳定职责，再进入具体架构和组件调查，避免从某个 Agent 框架、RAG 产品或 SaaS 产品倒推整个系统。

本文中的名称均为**候选工作用语**，不是正式术语定义，也不构成技术选型。所有关键技术概念使用英文名称，例如 `Control Plane`、`Agent Runtime`、`Knowledge Retrieval`、`Tool`、`Workflow`、`Sandbox`、`Prompt` 和 `Harness`；中文仅用于解释。引用 SaaS 或第三方方案仅用于观察系统如何组织能力；本方案仍遵循“除 LLM 外，运行组件必须由企业自行控制”的前提。

## 调研结论

成熟方案普遍不会把企业 Agent 简化为“聊天界面加模型和知识库”。它至少同时包含：

- 面向员工和业务系统的 `Experience` 入口。
- 负责 `Context`、`State` 和决策循环的 `Agent Runtime`。
- 可复用且受控的业务能力，包括 `Tool`、`Workflow`、`Skill` 和 `Human-in-the-Loop`。
- 带来源、权限和地域边界的 `Knowledge` 与 `Data` 能力。
- 与企业系统交互的 `Integration` 和执行边界。
- 可替换的 `Model Gateway` 与 `Sandbox`。
- 贯穿所有请求的 `Identity`、`Authorization`、`Policy`、安全、`Audit` 和运营治理。

其中，安全和治理不是某一层的附加功能，而是在检索、模型调用、工具执行和结果交付前都必须生效的控制边界。

## 两个组织维度

单一的线性分层不足以说明企业平台的职责，建议同时使用以下两个维度：

1. **Runtime Plane**：接受业务任务、组织 `Context`、检索知识、执行受控动作并交付结果。
2. **Control and Evidence Plane**：管理组织边界、`Identity`、`Policy`、版本、审批、`Audit`、`Evaluation` 和运营；它决定 `Runtime Plane` 在什么条件下可以执行，而不替代业务请求本身。

```text
员工 / 业务系统
        |
Experience and Task
        |
Agent Runtime and Orchestration
   +----+-----+----------------+
   |          |                |
Knowledge and Retrieval  Skill/Tool/Workflow  Enterprise Integration
   |          |                |
Data Services, Model Gateway, Sandbox, Platform Foundation

Organization, Identity, Authorization, Policy, Secrets, Region, Audit, Evaluation, Release Governance
贯穿每一条访问和执行路径

Domain Package (HR / Finance / ...) extends a Regional Platform Foundation
```

## 候选分层与核心概念

### 1. Organization, Governance, and Control Plane

这一层定义“谁拥有、谁能配置、哪些资源可以在何处使用”，而不直接处理用户业务任务。

| Candidate Concept | 责任 |
| --- | --- |
| Organization and Data Domain | 表达企业、部门、地区、业务域和环境的归属与隔离边界。 |
| Asset Catalog | 登记 `Agent`、`Skill`、`Tool`、`Connector`、`Knowledge Source`、模型接入和策略等受管资产。 |
| Lifecycle and Release | 支持草稿、评审、测试、审批、发布、回滚和停用，保留版本谱系。 |
| Policy Management | 集中维护 `Authorization`、数据使用、`Tool` 调用、模型使用、地域和保留策略。 |
| Risk and Operations Governance | 定义风险等级、上线门禁、`Evaluation` 要求、异常处置和责任人。 |

这个 `Control Plane` 应与 `Runtime` 解耦：平台管理员修改策略或发布版本，运行时在每次访问边界执行这些决定。

### Business Domain, Region, and Packaging

`Business Domain` 与 `Region` 是正交维度。前者是业务能力和业务语义的逻辑边界，后者是 `Deployment`、`Data Residency` 与合规边界。`Business Domain` 不应默认成为一套完整平台的复制单位；`Region` 也不意味着所有业务资产都必须独占或彼此不可复用。

| Candidate Concept | 责任 |
| --- | --- |
| Business Domain | 表达 HR、Finance 等业务能力、业务语义、领域 `Policy` 和责任边界；不等同于 `Deployment Unit`。 |
| Region | 表达由合规、安全与 `Data Residency` 决定的处理边界；它约束内容及其 `Index`、`Embedding`、缓存、`Session`、`Artifact`、`Trace` 和 `Audit` 的放置。 |
| Regional Deployment | 在一个 `Region` 内部署 `Runtime Plane` 所需的通用平台能力，可服务多个 `Business Domain`。 |
| Domain Package | 以可发布、可版本化的方式组合一个领域的 `Agent Definition`、`Skill`、`Workflow`、`Tool Contract`、`Policy Overlay`、`Content Package` 和 `Evaluation`，而不复制 `Platform Foundation`。 |
| Content Package | 发布可复用的 `Knowledge Base Content`、`Metadata`、`Retrieval Policy` 和使用约束；它不改变源内容的 `Authorization` 与 `Data Residency`。 |
| Shared Knowledge Base Content | 提供经治理发布、可被多个领域或地区在允许范围内使用的公共内容；必须声明所有者、消费者、`Data Classification`、可用 `Region`、撤销语义和 `Audit`。 |
| Shared Data Contract | 发布权威数据语义、计算口径和受限访问方式，避免 HR、Finance 等领域复制或各自解释同一事实。 |

共享不等于无控制的全局复制。跨 `Region` 的复制、同步或 `Federated Access` 需要由 `Policy` 显式允许；不能跨区的数据应在区域内处理，并只通过受批准的汇总结果或受限 `API` 支持跨领域协作。

### 2. Experience and Task

这一层承接用户意图和业务系统中的协作入口，不自行获得超出调用者权限的数据或能力。

| Candidate Concept | 责任 |
| --- | --- |
| Chat UI | 支持多轮对话、引用呈现、澄清问题、任务进度、人工审批和结果交付。 |
| Copilot | 嵌入企业内部系统，在当前页面、记录和业务动作的上下文中提供协作能力。 |
| Task and Case | 将一次业务诉求组织为可跟踪的目标、输入、状态、产物和处理结果，而不等同于聊天消息。 |
| Caller Context | 传递最终用户、组织、地区、业务对象、授权委托和交互渠道等可信 `Context`。 |

### 3. Agent Definition, Runtime, and Orchestration

这一层让模型参与理解、规划和对话，但模型不是访问控制或业务确定性的唯一来源。

| Candidate Concept | 责任 |
| --- | --- |
| Agent Definition | 组合目标、`Instructions`、可用知识范围、允许能力、策略约束和支持渠道，形成面向用户的业务能力包。 |
| Context Assembly | 将 `Task`、`Caller Context`、可用证据、已批准的配置和 `State` 组装为一次模型交互的输入。 |
| Orchestration Runtime | 管理 `Retrieval`、`Tool` 调用、`Skill` 调用、`Delegation`、重试、停止条件、预算和超时。 |
| Session and Task State | 区分短期对话连续性与可恢复的业务任务状态，并定义归属、保留和删除规则。 |
| Multi-Agent Delegation | 明确定义委派目标、可传递 `Context`、权限上限、预算和终止条件；不是默认共享全部权限和数据。 |

### Legacy Estate and Compatibility

企业中已有的 `Dify Workflow`、`Chatbot`、`Copilot`、`Knowledge Retrieval` 系统和顶层 `Router` 构成 `Legacy Estate`。它们可以分期接入，但不能把当前的直接调用关系当作新体系的默认结构。

| Candidate Concept | 责任 |
| --- | --- |
| Legacy Estate | 记录现有能力、所有者、依赖、协议、数据访问和风险，不因接入而默认取得新平台的信任。 |
| Adapter | 将存量能力封装为统一调用边界，收敛 `Identity Context`、`Authorization`、超时、错误语义和 `Audit`。 |
| Capability Contract | 声明能力入口、输入输出、权限、数据域、副作用、版本和运行约束，供 `Router` 和调用方审查。 |
| Router | 根据已发布 `Capability Contract`、可信 `Context` 和 `Policy` 处理初始分发；不是拥有任意业务权限的超级 `Agent`。 |
| Invocation Graph | 声明能力之间允许的调用方向与依赖关系，用于发现环路、限制深度和规划迁移。 |
| Delegation | 在 `Invocation Graph` 中明确允许的跨能力调用；每一跳都受最小权限、预算、超时、终止条件和 `Trace` 约束。 |

无约束的 `Agent/Bot -> Agent/Bot -> Agent/Bot` 调用链不属于兼容目标。只有能够映射为已发布 `Delegation` 的调用才可分期保留；无法满足 `Identity` 传播、`Authorization`、`Audit`、`maxDepth`、环路检测和失败语义要求的调用，应通过改造或下线消除。

### 4. Business Capabilities: Skill, Tool, Workflow, and Human-in-the-Loop

这一层把业务行为从 `Prompt` 中分离出来。不同概念的边界应保持清晰：

| Candidate Concept | 适用职责 | 不应承担 |
| --- | --- | --- |
| Skill / SOP | 固化可复用的业务知识、前置条件、步骤、可用能力、样例和验收规则。 | 绕过评审直接把自然语言流程上线。 |
| Tool | 以明确输入输出 `Contract` 封装查询、计算、文件处理或系统动作。 | 让模型获得任意网络、文件系统或管理员权限。 |
| Workflow | 承担确定性步骤、分支、重试、超时、补偿和长事务。 | 完全依赖模型的自由规划处理高风险写操作。 |
| Human-in-the-Loop | 提供澄清、复核、审批、接管和异常队列。 | 只在系统失败后才被动介入。 |

`Tool Catalog` 至少需要声明调用方权限、数据范围、副作用、幂等性、超时、审批要求和 `Audit` 字段。涉及写回、付款、对账确认、外发或生产变更的动作，应先经过确定性校验、预览或审批。

### 5. Knowledge Base System and Retrieval

`Knowledge Base System` 应被视为从 `Knowledge Source` 到带证据回答的完整链路，而不是单一 `Vector Database`。它负责接入和检索 `Knowledge Base Content`，不拥有 HR、Finance 等 source system 的全部信息。

| Candidate Concept | 责任 |
| --- | --- |
| Knowledge Source and Connector | 表达文档库、业务系统内容、数据库和其他来源，并接收内容、权限和变更信息。 |
| Knowledge Base Content Governance | 保存 `Content Identity`、版本、来源位置、所有者、分类、保留/删除和权限语义。 |
| Content Processing and Indexing | 完成 `Extraction`、`Normalization`、`Chunking`、`Augmentation`、`Embedding` 和 `Lexical`/`Vector Index`；所有派生物必须回溯原文版本和权限。 |
| Authorized Retrieval | 基于最终用户 `Identity`、组织/地区、`Task Context` 和 `Retrieval Policy` 做权限裁剪、`Hybrid Retrieval`、`Reranking` 和阈值判断。 |
| Grounded Answer | 为回答提供可追溯的 `Citation`；证据或权限不足时拒答、澄清或转人工。 |

同步建立可检索副本和查询时 `Federated Access` 可以并存，但都必须保留同样的 `Identity`、`Authorization`、`Audit` 和失效语义。原文、摘要、`Chunk`、`Embedding`、缓存、对话引用和检索日志都属于需要治理的数据副本。`Structured Business Data` 通常应通过 `Tool`、`Connector`、`Workflow` 或 `Shared Data Contract` 获取，不应被强行复制到 `Knowledge Base System`。

### 6. Enterprise Integration

这一层连接企业已有的记录、流程和事件。它必须保持原系统的权限和事务边界，而不能被 Agent 绕过。

| Candidate Concept | 责任 |
| --- | --- |
| System Connector | 封装到企业系统 `API`、数据库、消息或文件交换的受控访问。 |
| Resource and Action Contract | 定义可读资源、可执行动作、输入输出、幂等键、副作用和错误语义。 |
| Authorization Proxy | 将最终用户或受限 `Workload Identity` 转换为短期、最小范围的系统访问。 |
| Event and Callback | 接收数据变化、任务进度、审批结果和异步业务结果。 |

### 7. Platform Foundation

这一层提供可替换、可部署和可运维的运行能力。LLM 可以来自外部或自建服务，但模型接入必须收敛为企业自控的边界。

| Candidate Concept | 责任 |
| --- | --- |
| Model Gateway | 提供 `Model Catalog`、路由、`Failover`、预算、限流、凭据隔离、地域/数据处理策略和调用审计。 |
| Sandbox | 以 `Sandbox`、`Egress Control`、资源配额、文件隔离和短期密钥注入承接计算、文档处理或代码任务。 |
| State and Artifact Service | 保存 `Session`、`Task`、`Workflow State`、受控文件产物和删除/保留策略。 |
| Data and Retrieval Services | 承载 `Content Catalog`、`Index`、`Embedding`、缓存、配置和审计数据，并支持地域部署。 |
| Deployment and Operations Foundation | 覆盖自有环境的发布、弹性、备份、灾备、升级、`Observability` 和成本管理。 |

### 8. Cross-Cutting Security, Evidence, and Operations

这不是可被 Agent 指令替代的单独功能，而是每条运行路径的强制约束。

| Candidate Concept | 责任 |
| --- | --- |
| Identity and Workload Identity | 分别认证人、服务、`Agent`、`Tool` 和 `Connector`，支持短期 `Delegation` 与撤销。 |
| Authorization Decision and Enforcement | 按主体、资源、动作和 `Context` 做细粒度决定，并在 `Retrieval`、模型、`Tool`、数据读写和网络出口处执行。 |
| Secrets and Credentials | 集中保管、轮换并按最小范围下发凭据；`Prompt`、`Skill` 和 `Agent` 不持有长期高权密钥。 |
| AI Security Guardrails | 处理敏感数据、输入/间接 `Prompt Injection`、输出约束和高风险动作确认，但不替代访问控制。 |
| Audit and Observability | 关联调用者、`Agent`/`Skill`/`Policy` 版本、检索证据、授权决定、`Tool` 参数摘要、人工批准和 `Trace`。 |
| Evaluation and Feedback Loop | 在发布前后验证正确性、权限、风险、延迟和成本，并将结果用于迭代和下线决策。 |

## 关键边界

以下边界应在后续设计中保持独立：

1. **Knowledge Base Content 不等于 Retrieval Index。** `Index`、`Embedding` 和 `Chunk` 都是可重建的派生物，不能丢失原文身份、版本、权限或地域语义。
2. **Retrieval Authorization 不等于 Answer Filtering。** 必须在召回前或召回时按最终用户和 `Data Domain` 裁剪，不能先让模型或 `Reranker` 看到未授权内容。
3. **Agent 不等于 Workflow。** `Agent` 擅长理解、对话和选择下一步；高风险、可预测或需补偿的业务步骤应由受控 `Workflow` 承担。
4. **Skill 不等于 Prompt。** `Skill` 应是可测试、可审核、可版本化、可发布和可回滚的业务能力资产。
5. **Protocol Compatibility 不等于 Trust。** `MCP`、`API` 或其他连接协议只能定义交互方式；`Identity`、凭据、准入、网络隔离和 `Audit` 仍由企业平台负责。
6. **Model Safety 不等于 Authorization。** 内容 `Guardrail` 不能授予数据或 `Tool` 权限；`Authorization` 与 `Policy Enforcement` 必须独立存在。
7. **Observability 不等于 Audit。** `Trace`、`Metric` 和 `Log` 服务于运行诊断；业务 `Audit` 还需要说明谁在何种权限和版本下作出并执行了什么决定。

## 后续调查顺序

建议按依赖关系推进，而不是先选择 Agent 框架：

1. 明确 `Organization`、`Region`、`Data Domain`、`Identity` 和 `Authorization Delegation` 模型。
2. 调查 `Knowledge Base System`、`Knowledge Base Content Governance`、权限投影和 `Authorized Retrieval` 的自建实现路径。
3. 调查 `Tool`、`Workflow`、`Skill` 和 `Human-in-the-Loop` 的发布与执行模型。
4. 调查 `Model Gateway`、`Sandbox`、`State and Artifact Service` 的自建边界。
5. 调查 `Observability`、`Audit`、`Evaluation` 和风险治理如何贯穿以上能力。
6. 最后比较 `Agent Orchestration Framework` 和 `Chat UI`/`Copilot` 实现，它们应适配上述边界而不是定义上述边界。

## 参考方向

以下资料用于提取系统组织方式，不构成产品推荐或部署建议：

- [AWS Bedrock Agents](https://docs.aws.amazon.com/bedrock/latest/userguide/agents-how.html)：`Build-time`/`Runtime`、`Knowledge Base`、`Action Group`、`Session` 和 `Trace` 的分工。
- [AWS Bedrock Guardrails](https://docs.aws.amazon.com/bedrock/latest/userguide/guardrails.html)：独立、可版本化的输入输出 `Safety Policy` 资产。
- [Microsoft Copilot Connectors](https://learn.microsoft.com/en-us/microsoft-365/copilot/extensibility/overview-copilot-connector)：同步 `Indexing` 与 `Federated Access` 两种知识接入模式。
- [Microsoft 365 Multi-Geo](https://learn.microsoft.com/en-us/microsoft-365/enterprise/microsoft-365-multi-geo?view=o365-worldwide)：集中管理与不同 `Geography` 的数据驻留可以并存；本方案只借鉴其分离组织边界与数据位置的方式。
- [Azure AI Search Security Filter Pattern](https://learn.microsoft.com/en-us/azure/search/search-security-trimming-for-azure-search)：以用户或组 `Identity` 在 `Retrieval` 时裁剪结果的模式。
- [Elastic Document and Field Level Security](https://www.elastic.co/docs/deploy-manage/users-roles/cluster-or-deployment-auth/controlling-access-at-document-field-level)：`Retrieval` 层的文档和字段访问边界。
- [LangGraph Overview](https://docs.langchain.com/oss/python/langgraph/overview)：长时、有状态 `Agent` 的 `Orchestration`、`Human-in-the-Loop` 和持久执行概念。
- [OpenAI Agents SDK](https://github.com/openai/openai-agents-python)：`Agent`、`Tool`、`Handoff`、`Guardrail`、`Session` 和 `Trace` 的职责拆分。
- [Dify](https://github.com/langgenius/dify)：`Workflow`、`RAG`、`Agent`、模型接入和 `Observability` 并列的平台组织方式。
- [NIST AI RMF](https://nvlpubs.nist.gov/nistpubs/ai/NIST.AI.100-1.pdf) 与 [NIST Zero Trust Architecture](https://nvlpubs.nist.gov/nistpubs/SpecialPublications/NIST.SP.800-207.pdf)：风险治理以及 `Policy Decision` 与 `Policy Enforcement` 分离。
- [MCP Architecture](https://modelcontextprotocol.io/specification/2025-11-25/architecture/)：`Host`、`Client` 和 `Server` 的责任分工；该协议本身不替代企业 `Authorization` 边界。
- [OpenTelemetry Observability Primer](https://opentelemetry.io/docs/concepts/observability-primer/)：`Trace`、`Metric` 与 `Log` 的基础划分。

## 待决问题

1. `Organization`、部门、`Region` 和 `Data Domain` 是否需要彼此独立建模，以及哪些组合构成硬隔离边界？
2. 哪些知识需要建立本地 `Index` 副本，哪些可以在受控 `Authorization` 下做实时 `Federated Access`？
3. `Skill` 面向业务部门时，应使用怎样的表达方式，才能同时支持可读、可测试、可审批和可执行？
4. 哪些业务动作必须经过 `Workflow` 和 `Human-in-the-Loop`，哪些动作可以由 `Agent` 在预定义权限内直接执行？
5. `LLM` 调用是否允许跨 `Region`，哪些数据类别不得进入外部模型，以及由谁决定例外？
6. 哪些 `Platform Foundation` 能力必须随 `Regional Deployment` 部署，哪些 `Control Plane` 能力可集中管理但不接触受限数据？
7. `Domain Package`、`Content Package`、`Shared Knowledge Base Content` 和 `Shared Data Contract` 的发布、依赖、兼容性和撤销模型应如何定义？

## Concept Delta（审计）

本文件提出了 `Organization and Data Domain`、`Business Domain`、`Region`、`Regional Deployment`、`Domain Package`、`Content Package`、`Knowledge Base System`、`Shared Knowledge Base Content`、`Structured Business Data`、`Temporary Data`、`Memory`、`Personalization Preference`、`Shared Data Contract`、`Agent Runtime and Orchestration`、`Skill`、`Authorized Retrieval`、`Model Gateway`、`Sandbox`、`Control Plane` 和 `Evidence and Operations Plane` 等候选概念，用于划分后续调查范围。

这些名称已登记到 `references/glossary.md`，并由 `references/concepts/agent-platform.md` 和 `references/concept-decisions/2026-07-19-information-context-vocabulary.md` 维护边界与决策记录。除 glossary 中明确的 `deprecated` alias 外，当前术语仍为 `proposed`，不得视为 canonical 概念，也不应据此直接建立跨模块 API 或 data model。

### Governance links

- `references/concept-governance.md`
- `references/glossary.md`
- `references/concepts/agent-platform.md`
- `references/concept-decisions/2026-07-19-information-context-vocabulary.md`

### Governance completeness verdict

- `PASS` for registration completeness; final canonical promotion remains pending owner approval.
