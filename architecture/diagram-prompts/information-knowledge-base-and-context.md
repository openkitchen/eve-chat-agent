# Information, Knowledge Base System, and Context Diagram Prompt

## 用途

这份 prompt 生成一张宽幅横向的 `Swimlane` 概念图。它要让读者沿每条 lane 从下到上理解：

1. `Information` 的子概念是什么。
2. 该类信息在现实中由哪些 external system、content source 或 runtime source 承载。
3. 平台通过哪些高一级的 architecture pattern，例如 `RAG`、`Tool Access`、`Domain Package`、`Agent Harness` 或 `Control Plane` 获取并处理它。
4. 它最终以什么名称和角色进入 `Context Assembly`，成为 `LLM Context` 的一部分。

`Information` 与 `Context Material` 必须上下对齐，形成主要阅读路径。中间不使用 `WHERE INFORMATION LIVES TODAY` 或 `HARNESS / AGENT FRAMEWORK ACCESS PATHS` 之类的抽象大框；中间的 individual card 和它们的关系本身就是要表达的平台全局结构。

图中优先使用读者熟悉的 high-level term 和常见 architecture icon。`RAG` 在本图中是 `Knowledge Base System` 内的 retrieval pattern label，不替代 `Knowledge Base System` 作为平台组件名称。`Ingestion`、`Index / Embedding`、`REST API` 等 implementation detail 仅在空间充足时作为辅助信息出现，不能成为主标签或主阅读路径。

## GPT Image 2 Prompt

```text
Create one very wide landscape 2:1 concept diagram, at the maximum available wide resolution, approximately 2048x1024, using the exact visual language from the supplied architecture diagram style guide.

Use a pure white canvas, isolated white rectangular cards with approximately 1 px black outlines and 3 px corner radius,
compact crisp mechanically typeset uppercase labels, sparse layout, generous white negative space, and pale-yellow cards only for active context material.
Use no overall headline, no subtitle, no legend, no explanatory paragraph, no decorative frame, no cloud graphics, and no vendor logos.
All visible labels must be English and uppercase, using only the declared labels below. Do not invent any labels.
Minimize text: every card has one high-level primary label of at most two short lines. Add at most one compact secondary label only when there is clear unused space.
Represent secondary detail with icons whenever possible; never shrink text, stack long lists, or turn a card into a technology checklist.

Give every primary card one small functional black outline icon to the left of its label. Use thin, consistent, Lucide-like line icons;
do not use filled icons, colourful pictograms, emoji, logos, people, brains, or cloud graphics. Reuse the same icon family when a lower INFORMATION card,
a middle topology card, and an upper CONTEXT MATERIAL card represent the same conceptual path. Do not add icons to every nested sublabel.

Use these icon assignments:
- REFERENCE CONTENT, CONTENT SOURCES, KNOWLEDGE ACCESS, KNOWLEDGE BASE SYSTEM, RAG, and EVIDENCE: document with magnifier.
- STRUCTURED BUSINESS DATA, BUSINESS SYSTEMS, and FACTS / RESULTS: table or grid with checkmark.
- TOOL ACCESS: plug or link.
- PROCEDURAL KNOWLEDGE, DOMAIN PACKAGE, SKILL, and GUIDANCE: checklist or package.
- TEMPORARY DATA, USER INPUT, TASK STATE, and TASK MATERIAL: file with upward arrow.
- MEMORY, RUNTIME STATE, and MEMORY SERVICE: history or archive clock.
- PERSONALIZATION PREFERENCE, PREFERENCES, and PROFILE SERVICE: sliders.
- POLICY AND INSTRUCTIONS, POLICY REPOSITORY, CONTROL PLANE, CAPABILITY CONTRACT, and INSTRUCTIONS: shield with checkmark or lock.
- AGENT HARNESS: loop arrows.
- SANDBOX: terminal window.
- CONTEXT ASSEMBLY: merge arrows.
- LLM CONTEXT: compact text window with stacked lines.
- MODEL ACCESS and MODEL GATEWAY: route or gateway.
- LLM PROVIDER: compact chip.

The composition has three vertical levels plus one model edge:
- a wide CONTEXT ASSEMBLY container across the top;
- a free-form middle topology of real systems and platform components, with no enclosing middle container and no middle section title;
- a wide INFORMATION container across the bottom.
- a small MODEL ACCESS path on the far right, beginning at LLM CONTEXT and ending at LLM PROVIDER.

The top and bottom containers contain seven aligned columns. Each vertical lane describes the primary route from one INFORMATION category, through real sources and platform mechanisms, into one named CONTEXT MATERIAL card. The middle cards may shift left or right to show shared components and non-linear relationships, but preserve an understandable primary correspondence between the aligned top and bottom columns.

TOP LEVEL: CONTEXT ASSEMBLY.
Draw one wide white outer container titled CONTEXT ASSEMBLY. It spans almost the full width of the canvas.
Inside it, place these seven pale-yellow context material cards in one horizontal row, left to right:
1. EVIDENCE
2. FACTS / RESULTS
3. GUIDANCE
4. TASK MATERIAL
5. MEMORY
6. PREFERENCES
7. INSTRUCTIONS

Use only these compact secondary labels when there is enough space:
- EVIDENCE: CITATIONS.
- FACTS / RESULTS: GOVERNED.
- GUIDANCE: SKILL.
- TASK MATERIAL: INPUTS / TOOL RESULTS.
- INSTRUCTIONS: SYSTEM / CAPABILITY.

Below this row, centered inside the same outer container, place one white card titled LLM CONTEXT.
Use seven very short thin grey connectors from the seven context material cards toward LLM CONTEXT. These lines are converging selection paths, not a process sequence.
Do not show ELIGIBILITY, TRUST, FRESHNESS, RELEVANCE, AUTHORITY, BUDGET, ranking scores, or an internal governance checklist inside CONTEXT ASSEMBLY.

BOTTOM LEVEL: INFORMATION.
Draw one wide white outer container titled INFORMATION. It spans almost the full width of the canvas and is aligned with CONTEXT ASSEMBLY.
Add this small sublabel inside the container:
CONCEPTUAL UMBRELLA / NOT A SYSTEM COMPONENT.
Inside it, place these seven white cards in one horizontal row, aligned directly below the corresponding top context material cards:
1. REFERENCE CONTENT
2. STRUCTURED BUSINESS DATA
3. PROCEDURAL KNOWLEDGE
4. TEMPORARY DATA
5. MEMORY
6. PERSONALIZATION PREFERENCE
7. POLICY AND INSTRUCTIONS

Do not represent INFORMATION as a database, repository, or source-of-truth system. It is a conceptual classification only.

MIDDLE LEVEL: PLATFORM AND SOURCE TOPOLOGY.
Do not draw an enclosing middle container. Place the following six independent white concept containers. They are not required to be independent deployable units. Their inner cards are a concept-level vocabulary, not a complete implementation checklist.

Near lane 1, place a large card titled KNOWLEDGE ACCESS. Inside it, arrange five compact cards:
KNOWLEDGE BASE SYSTEM,
RAG,
RETRIEVAL,
CITATION,
FEDERATED ACCESS.
Use the document-search icon as the primary visual. Do not list Ingestion, Content Catalog, Index, Embedding, or other low-level implementation terms.
Place one smaller external source card below or to the side titled CONTENT SOURCES. Use document, wiki, and globe outline icons; add WIKI / SHAREPOINT / DOCUMENT / WEB only if there is clear unused space.

Near lane 2, place a large card titled TOOL ACCESS. Inside it, arrange four compact cards:
TOOL,
CONNECTOR,
WORKFLOW,
SHARED DATA CONTRACT.
Use a plug icon as the primary visual. MCP may appear as a tiny optional protocol label only if there is clear unused space. Do not make REST API a main label.
Place one smaller external source card below or to the side titled BUSINESS SYSTEMS. Use neutral application or record icons; add HR / FINANCE / ERP / CRM only if there is clear unused space.

Near lane 3, place a large card titled DOMAIN PACKAGE. Inside it, arrange six compact cards:
AGENT DEFINITION,
SKILL,
PROMPT,
POLICY OVERLAY,
CONTENT PACKAGE,
EVALUATION.
Use a package or checklist icon as the primary visual.
Place one smaller external source card below or to the side titled BUSINESS PROCEDURES. Use checklist and document icons; add SOP / RULE / PLAYBOOK only if there is clear unused space.

Place one large central card titled AGENT HARNESS. It is the runtime framework that executes an Agent Definition; do not use it as an enclosing boundary for all middle components.
Inside it, arrange four compact cards:
AGENT LOOP,
TOOL INVOCATION,
STATE MANAGEMENT,
MODEL INVOCATION.
Use loop arrows as the primary visual.
The top-level CONTEXT ASSEMBLY container is the visible conceptual expansion of the context-assembly function performed by AGENT HARNESS. Do not duplicate a separate CONTEXT ASSEMBLY card inside AGENT HARNESS.

Near lanes 4 through 6, place a large card titled RUNTIME STATE. Inside it, arrange five compact cards:
SESSION STATE,
TASK STATE,
MEMORY,
PERSONALIZATION PREFERENCE,
ARTIFACT.
Place one smaller separate card nearby titled SANDBOX.
Place one external runtime-source card near TASK STATE titled USER INPUT. Use upload and document icons; add USER MESSAGE / FILE UPLOAD only if there is clear unused space.

Near lane 7, place a large card titled CONTROL PLANE. Inside it, arrange five compact cards:
POLICY,
CAPABILITY CONTRACT,
IDENTITY,
AUTHORIZATION,
AUDIT / TRACE.
Place one smaller external source card below or to the side titled POLICY REPOSITORY.

At the far right, just outside the CONTEXT ASSEMBLY container, place a white card titled MODEL ACCESS. Inside it, arrange two compact cards:
MODEL GATEWAY,
LLM PROVIDER.

Use the following primary directional paths. Draw thin grey orthogonal connectors with small arrowheads pointing upward or toward the right. Preserve their meaning even if the exact physical route must bend around another card. Do not connect every nested label.

1. REFERENCE CONTENT -> CONTENT SOURCES -> KNOWLEDGE ACCESS -> AGENT HARNESS -> EVIDENCE.
2. STRUCTURED BUSINESS DATA -> BUSINESS SYSTEMS -> TOOL ACCESS -> AGENT HARNESS -> FACTS / RESULTS.
3. PROCEDURAL KNOWLEDGE -> BUSINESS PROCEDURES -> DOMAIN PACKAGE -> AGENT HARNESS -> GUIDANCE.
4. TEMPORARY DATA -> USER INPUT -> RUNTIME STATE -> AGENT HARNESS -> TASK MATERIAL.
5. MEMORY -> RUNTIME STATE -> AGENT HARNESS -> MEMORY.
6. PERSONALIZATION PREFERENCE -> RUNTIME STATE -> AGENT HARNESS -> PREFERENCES.
7. POLICY AND INSTRUCTIONS -> POLICY REPOSITORY -> CONTROL PLANE -> AGENT HARNESS -> INSTRUCTIONS.
8. LLM CONTEXT -> MODEL ACCESS -> MODEL GATEWAY -> LLM PROVIDER.

Add only these three secondary relationships, using thin grey lines without arrowheads:
- DOMAIN PACKAGE connects to INSTRUCTIONS, showing that package policy can contribute to context.
- TOOL ACCESS connects to TASK MATERIAL, showing that governed tool output can become task-scoped material.
- CONTROL PLANE connects to KNOWLEDGE ACCESS and TOOL ACCESS, showing that policy applies across access paths.

Keep the seven primary information paths visually traceable from bottom to top. They intentionally converge at AGENT HARNESS and then fan into named context material. This is not seven independent pipes: the diagram must show that AGENT HARNESS brings package behavior, knowledge access, tool access, runtime state, and policy together before context reaches the model.

Use only card boundaries, whitespace, and the declared connectors. Do not create an enclosing box or title around all middle components. Do not render the middle as a generic pipeline, a deployment topology, a database schema, or a dense flowchart.
Do not show pods, containers, queues, cloud services, database cylinders, network zones, product logos, vendor logos, people, or a generic agent-brain illustration.

Negative prompt:
No black canvas, no off-white paper, no gradients, no 3D, no isometric view, no hand-drawn type,
no handwriting, no marker texture, no large heading, no subtitle, no sticky notes, no coloured section frames,
no cloud-provider logos, no vendor branding, no people, no brain illustration, no stock imagery,
no dashboard widgets, no glassmorphism, no neon glow, no colourful infographic palette,
no generic SaaS architecture poster, no invented labels, no Chinese labels, no dense flowchart,
no decorative arrows, no enclosing middle container, no internal CONTEXT ASSEMBLY criteria,
no filled icons, no colourful icons, no emoji, no logos, no people icons, no brain icons, and no cloud icons.
```

## 图的阅读方式

每条 primary lane 都遵循同一读法：

```text
INFORMATION category
        -> real-world source or runtime source
        -> platform component and access mechanism
        -> named CONTEXT MATERIAL
        -> LLM CONTEXT
```

中间的 `Knowledge Access`、`Tool Access`、`Domain Package`、`Agent Harness`、`Runtime State`、`Control Plane` 和 `Model Access` 是图的一部分，不是一个需要被隐藏的 implementation detail。它们可跨 lane 复用，因而不要求严格的上下对齐。

## Concept Delta

- No canonical concept is introduced, renamed, or re-scoped.
- `RAG`, `MCP`, `Agent Definition`, `Agent Loop`, and `Model Invocation` are visual working vocabulary inside broader concept containers; they do not establish new platform entities or API boundaries.
- The diagram changes from a three-band component grouping to a wide `Swimlane` view with explicit primary trace paths and compressed technical detail.
- `Information` remains a conceptual umbrella and `Context Assembly` remains the top-level context destination.
