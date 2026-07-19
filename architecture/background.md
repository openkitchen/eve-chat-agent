# 企业自主可控 Agent 方案：背景与调查前提

## 文档目的

本目录用于沉淀企业自主可控 Agent 整体方案的设计材料。本文件记录方案的业务背景、边界和调查前提，作为后续架构设计、能力分层、组件选型和验证计划的共同起点。

本文不做技术选型，不指定供应商，也不把调研对象视为默认采用对象。

## 设计背景

企业需要一套可在自身环境中建设、运行和演进的 Agent 能力，以支持内部知识使用、业务系统协作和真实业务任务处理。方案需要能够随组织、地区、部门、权限体系和业务流程变化而调整，而不能将关键能力绑定在不可控的外部平台或固定产品流程中。

本文中的关键技术名词使用英文，例如 `Agent`、`Chatbot`、`Copilot`、`Skill`、`Workflow`、`Router`、`Sandbox`、`Prompt` 和 `Harness`；中文仅用于解释其业务含义和设计边界。

## 自主可控前提

以下前提是后续设计与调查的硬约束：

1. 除 LLM 外，系统中的组件必须由企业自行控制。
2. 不使用 SaaS 形式的业务服务作为运行依赖。数据、运行环境、身份与权限、知识处理、工具执行、审计和运维能力都必须部署和运行在企业可控的环境中。
3. 可以使用第三方成熟解决方案，但前提是企业能够自行部署、配置、定制、升级、替换和审计它们。
4. 安全是首要设计约束。后续方案必须把身份认证、授权、租户或组织隔离、数据访问边界、工具权限、密钥管理、操作审计和运行隔离作为整体设计的一部分，而不是事后补充。
5. LLM 可以是外部或自建的模型能力；无论其来源如何，系统其余部分都不应因此失去控制权，且需要保留模型接入、配置和替换的能力。

## Business Domain and Regional Deployment

`Business Domain` 与 `Region` 是两个独立维度，不能混为同一种隔离或部署规则。`Business Domain` 例如 HR、Finance 或其他业务领域，决定业务能力、`Knowledge`、`Skill`、`Workflow`、`Tool Contract` 和业务 `Policy` 的边界。`Region` 则由安全、合规和 `Data Residency` 要求决定部署位置与数据处理边界。

过去常按 `Business Domain` 复制整套系统，分别建设相似的 `Chatbot` 或 `Copilot`。新体系不以领域复制完整 `Platform Foundation` 为目标：同一 `Regional Deployment` 应能承载多个 `Business Domain`，共享通用的 `Runtime`、`Model Gateway`、`Sandbox`、`Identity`、`Authorization`、`Audit`、`Observability` 和运维能力；领域差异通过可发布、可版本化的 `Domain Package` 扩展。

每个因合规而独立的 `Region` 可以部署一套或多套运行实例，但其边界必须覆盖该地区实际处理的数据及其派生物，包括原始内容、`Index`、`Embedding`、缓存、`Session`、`Artifact`、`Trace` 和 `Audit`。不应只把原文限制在地区内，却把其他可还原或泄露业务信息的派生数据放到别处。

### Domain Package and Shared Assets

`Domain Package` 是在统一 `Platform Foundation` 上发布某个 `Business Domain` 能力的单位。它可以组合该领域的 `Agent Definition`、`Skill`、`Workflow`、`Tool Contract`、`Policy Overlay`、`Knowledge Source`、`Content Package`、`Evaluation` 和版本信息，但不复制底层运行环境。

并非所有 `Information` 和 `Data` 都属于某个单独领域或地区。新体系需要支持经治理发布的 `Shared Knowledge Base Content` 和 `Shared Data Contract`，使 HR、Finance 等领域能够复用全局规则、公共内容和权威计算语义，避免各领域各自复制、解释或维护同一事实。例如，涉及 HR 的 Finance 计算应依赖明确发布的共享数据语义和访问契约，而不是复制 Finance 数据或绕过其权限边界。

“共享”不等于无条件复制或全局可见。每个 `Shared Knowledge Base Content` 和 `Shared Data Contract` 都必须声明所有者、消费者、可用 `Region`、`Data Classification`、`Authorization`、更新/撤销语义和 `Audit` 要求。跨 `Region` 的复制、同步或 `Federated Access` 必须由合规策略显式允许；无法跨区的数据应保持区域内处理，并通过受批准的汇总结果或受限接口参与跨领域协作。

## Existing Estate

企业内部已经存在多种局部的 `Chatbot`、`Agent`、`Copilot`、`Knowledge Retrieval` 系统和 `Workflow`。例如，部分业务能力由 `Dify Workflow` 提供，部分 `Copilot` 是嵌入业务系统的基于 Chat 的 `Knowledge Retrieval` 系统，另有顶层 `Router` 负责转发请求。

这些能力是后续方案必须面对的存量，不应假设它们天然遵循同一套 `Identity`、`Authorization`、`Context`、`Tool Contract`、`Audit` 或生命周期规则。当前可能出现 `Dify Workflow` 调用 `Chatbot`、或 `Chatbot` 反向调用 `Dify Workflow` 的情况；这种双向和递归式调用不能被视为新体系的默认兼容模式。

## Compatibility and Transformation

新体系不要求立即替换所有 `Legacy Estate`，但必须通过分层兼容和分期治理收敛其边界：

1. **Discovery**：建立 `Agent`、`Chatbot`、`Copilot`、`Workflow`、`Router`、`Knowledge Source`、`Tool`、`Invocation Relationship` 和数据访问范围的清单。
2. **Encapsulation**：通过受控 `Adapter` 接入存量能力，统一 `Capability Contract`、`Identity Context`、`Authorization`、超时、错误语义和 `Audit`；不允许新能力直接依赖某个存量产品的内部调用方式。
3. **Convergence**：将可保留的能力逐步迁移到统一的 `Skill`、`Tool`、`Workflow` 或 `Agent` 边界，并清除重复、反向或无法审计的调用关系。
4. **Retirement**：对不能满足安全、权限、审计、可运维或可迁移要求的存量能力制定替换和下线计划，而不是为了短期兼容将问题永久保留。

### Router and Delegation

顶层 `Router` 是后续设计的重点，但它不应成为拥有任意业务权限的“超级 Agent”。它的职责是基于已发布的 `Capability Contract`、可信 `Identity Context`、组织/地域边界和策略，将初始请求分发到允许的入口能力，并记录可审计的路由决定。

新体系不支持无约束的 `Agent/Bot -> Agent/Bot -> Agent/Bot` 调用链。确有必要的跨能力协作只能定义为声明式 `Delegation`，由 `Invocation Graph` 明确允许，并至少受到以下约束：

- 调用方向、目标能力和可传递的上下文由发布配置声明，禁止运行时任意发现或回调。
- 每次调用传播受限的 `Identity Context` 和最小权限委托，不能把调用方或平台的高权限整体转交。
- `maxDepth`、环路检测、预算、超时、失败语义和终止条件必须由平台强制执行。
- 每一跳都必须保留 `Trace`、版本、授权决定、输入输出摘要和副作用记录。
- 涉及写操作的 `Delegation` 必须进入 `Workflow`、确定性校验和必要的 `Human-in-the-Loop`，不能依赖多层 Agent 自由转发。

现有嵌套调用应先经过 `Discovery` 和风险评估：能够映射为受控 `Delegation` 的才分期保留；无法满足上述约束的调用必须改造或移除。

## 调查前提

调研范围会覆盖市面上的主要解决方案，包括 SaaS 产品、开源项目和可私有部署的商业产品。调查 SaaS 方案的目的，是理解其如何组织能力、边界、`Workflow` 和治理机制，而不是将其作为本方案的运行依赖。

调查重点包括但不限于：

- `Knowledge Ingestion`、组织、`Retrieval`、权限控制和地域隔离的方式。
- Chat UI、业务系统 Copilot 和 Agent 的职责划分与协作方式。
- `Tool Invocation`、业务 `Workflow` 执行、`Human-in-the-Loop` 和可追溯性的组织方式。
- 面向业务部门的 SOP 与业务知识沉淀、发布、版本管理和复用方式。
- 自建部署、配置扩展、安全治理、可观测性和运维的实现边界。

调研结论需要区分“值得借鉴的系统组织方式”和“可在企业可控边界内采用的具体组件”，避免因为某个产品体验完整而直接引入不可控的服务依赖。

## 必须覆盖的业务场景

后续整体方案至少覆盖以下场景：

1. 企业各部门以及不同地区的 `Knowledge Base`。
2. 面向 `Knowledge Base` 的 `Retrieval`、汇总与回答。
3. 企业内部系统中的 `Copilot`。它需要使用 `Knowledge Base` 中的知识，也需要在受控权限内使用系统内部知识。
4. 用户通过 Chat UI 或 Copilot 解决真实业务问题，例如文档 Review、数据计算和对账等任务。
5. 业务部门以类似 Skill 的方式，将 SOP 或业务知识固化为可复用能力，并持续提升 Chat UI、Copilot 和其他 Agent 的业务能力。

## 当前范围边界

本文件只定义背景和调查约束。以下内容留待后续文档决定：

- 总体架构分层与组件边界。
- `Knowledge Base`、`Retrieval`、`Tool Execution`、`Enterprise Integration` 和 `Skill Management` 的具体实现。
- `LLM` 的接入策略、模型路由和数据保护策略。
- `Business Domain`、`Domain Package`、`Content Package`、`Knowledge Base System`、`Shared Knowledge Base Content`、`Structured Business Data`、`Temporary Data`、`Memory`、`Shared Data Contract` 和 `Regional Deployment` 的具体模型。
- 第三方方案的比较维度、候选清单与准入标准。
- `Security Model`、`Authorization Model`、`Audit` 要求和 `Deployment Topology` 的具体设计。

## 术语说明

本文中的 `Knowledge Base System`、`Copilot`、`Agent`、`Skill` 和 `SOP` 均沿用当前业务讨论中的工作用语。术语边界和候选定义见 `architecture/concepts/` 与 `references/concepts/agent-platform.md`；除 glossary 中明确的 `deprecated` alias 外，它们目前仍是 `proposed`，不代表已完成 canonical 决策。

## Concept Delta（Governance）

本背景文档使用 `Information`、`Knowledge Base System`、`Shared Knowledge Base Content`、`Structured Business Data`、`Temporary Data`、`Memory`、`Domain Package`、`Business Domain` 和 `Regional Deployment` 等候选术语，用于界定调查范围。

治理链接：

- `references/concept-governance.md`
- `references/glossary.md`
- `references/concepts/agent-platform.md`
- `references/concept-decisions/2026-07-19-information-context-vocabulary.md`

Governance completeness verdict: `PASS` for registration completeness; final canonical promotion remains pending owner approval.
