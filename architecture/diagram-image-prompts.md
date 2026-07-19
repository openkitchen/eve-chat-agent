# Architecture Diagram Image Prompts

## Use

Generate each image separately with GPT Image 2. These prompts follow [diagram-style-guide.md](diagram-style-guide.md) and are intentionally separated by diagram purpose:

1. `System Concept Map` identifies logical concepts and relationships.
2. `Deployment Topology` identifies high-level placement and regional boundaries.
3. The four interaction diagrams expand the most important runtime relationships.

The prompts must not be merged into one generic platform overview. Render every label exactly as written, in English and uppercase. Do not add labels, products, or components that are not listed. Apply the common negative prompt from the style guide to every image.

## 1. System Concept Map

**Purpose:** Identify the major logical concepts and their semantic relationships. This is not a deployment diagram: boxes are concept groups, not pods, services, or independently deployable units.

```text
Create a landscape 3:2 system concept map, 1536x1024, following the supplied architecture diagram visual style:
solid near-black canvas, warm-white rectangular cards with thin black outlines, small corner radius,
black monospaced uppercase labels, pale-yellow highlight cards, fine grey orthogonal relationship lines,
and generous empty space. Use no physical infrastructure, no containers that imply deployment, and no cloud symbols.

Arrange five logical concept groups on a clean grid:

1. Upper left white group titled BUSINESS AND SCOPE. Inside it:
   ORGANIZATION, BUSINESS DOMAIN, REGION, DATA DOMAIN.
2. Center white group titled DOMAIN PACKAGE. Inside it, four pale-yellow cards:
   AGENT DEFINITION, SKILL, WORKFLOW, CONTENT PACKAGE.
3. Upper right white group titled SHARED ASSETS. Inside it:
   SHARED KNOWLEDGE BASE CONTENT and SHARED DATA CONTRACT.
4. Lower center white group titled RUNTIME CAPABILITIES. Inside it:
   AGENT, ROUTER, KNOWLEDGE RETRIEVAL, TOOL / CONNECTOR, SANDBOX.
5. Lower right white group titled CONTROL AND COMPATIBILITY. Inside it:
   CONTROL PLANE, POLICY, LEGACY ESTATE, ADAPTER.

Use relationship labels on short lines, exactly as follows:
BUSINESS DOMAIN -- owns --> DOMAIN PACKAGE
DOMAIN PACKAGE -- contains --> AGENT DEFINITION, SKILL, WORKFLOW, CONTENT PACKAGE
DOMAIN PACKAGE -- uses --> SHARED KNOWLEDGE BASE CONTENT and SHARED DATA CONTRACT
AGENT -- uses --> KNOWLEDGE RETRIEVAL and TOOL / CONNECTOR
ROUTER -- selects --> AGENT, WORKFLOW, ADAPTER
CONTROL PLANE -- governs --> DOMAIN PACKAGE, SHARED ASSETS, POLICY
ADAPTER -- wraps --> LEGACY ESTATE
REGION -- constrains --> DATA DOMAIN and RUNTIME CAPABILITIES

Use different line weights only to distinguish containment from usage. Do not draw a linear request flow.
Do not show REGION A / REGION B, replicas, databases, pods, or vendor products. All labels must remain short and legible.
```

## 2. Deployment Topology

**Purpose:** Show high-level component placement after deployment, including the distinction between a reusable platform foundation and regional runtime boundaries.

```text
Create a landscape 3:2 high-level deployment topology diagram, 1536x1024, in the supplied reference style:
solid near-black background, warm-white outlined containers, pale-yellow runtime cards, black monospaced uppercase labels,
fine grey orthogonal connectors, and large clear spacing. This is a placement diagram, not a detailed request sequence.

At the top, place a wide white container titled CONTROL PLANE.
Inside it, show four compact cards:
ASSET CATALOG, POLICY SERVICE, PACKAGE REGISTRY, RELEASE GOVERNANCE.
Add a small annotation: CONTROL METADATA ONLY.

Below it, draw two equal large outlined containers side by side:
REGIONAL DEPLOYMENT A and REGIONAL DEPLOYMENT B.
Inside each regional container, use the same six high-level cards:
EXPERIENCE GATEWAY / ROUTER,
AGENT RUNTIME,
KNOWLEDGE AND DATA SERVICES,
WORKFLOW / TOOL GATEWAY,
SANDBOX,
REGIONAL AUDIT / OBSERVABILITY.

Inside each regional container, place two small white cards connected to AGENT RUNTIME:
HR DOMAIN PACKAGE and FINANCE DOMAIN PACKAGE.
The two packages must sit on the same regional platform foundation; do not draw a separate full platform stack for each package.

Below the regional containers, place one external white card titled LLM PROVIDER.
Connect each regional MODEL GATEWAY card to LLM PROVIDER through a thin line labeled MODEL REQUEST.
Show MODEL GATEWAY as a small card inside each AGENT RUNTIME or KNOWLEDGE AND DATA SERVICES boundary.

Between the two regional containers, place a white card titled SHARED ASSET POLICY.
Use dashed grey lines from it to SHARED KNOWLEDGE BASE CONTENT and SHARED DATA CONTRACT labels inside the regional data services.
Do not draw direct unrestricted data replication between regions.

Make the regional boundaries visibly contain the content, index, embedding, cache, session, artifact, trace, and audit data for that region.
No Kubernetes symbols, vendor logos, cloud maps, or low-level infrastructure details.
```

## 3. Routing and Delegation

**Purpose:** Show the governed request entry point and the allowed invocation graph, including the treatment of `Legacy Estate`.

```text
Create a landscape 3:2 interaction architecture diagram, 1536x1024, using the supplied visual style:
solid black canvas, warm-white cards, pale-yellow control cards, thin black outlines, grey orthogonal arrows,
monospaced uppercase labels, and generous empty space.

On the far left, place two white input cards stacked vertically:
CHAT UI and COPILOT.
Their one-way arrows converge on a central pale-yellow card: ROUTER.

Above ROUTER, place two white governance cards:
CAPABILITY CONTRACT and POLICY.
Below ROUTER, place one white card: INVOCATION GRAPH.
Connect CAPABILITY CONTRACT, POLICY, and INVOCATION GRAPH to ROUTER with thin lines.

On the right, place four destination cards in a horizontal row:
DOMAIN AGENT, WORKFLOW, TOOL / CONNECTOR, LEGACY ADAPTER.
Draw allowed one-way arrows from ROUTER to each destination.

To the far right of LEGACY ADAPTER, place a small outlined group titled LEGACY ESTATE.
Inside it, use two muted white cards: DIFY WORKFLOW and CHATBOT.
Only LEGACY ADAPTER may connect to LEGACY ESTATE.

Below all runtime cards, place a wide white card:
IDENTITY CONTEXT / AUTHORIZATION / TRACE / MAX DEPTH.
Draw thin vertical lines from ROUTER and all destinations to this control strip.

Add one small dashed blocked arrow with the exact label:
NO UNBOUNDED AGENT / BOT CHAIN.
The blocked arrow must not connect any two runtime cards. Do not draw bidirectional recursive arrows.
ROUTER is a routing policy enforcement point, not a super-agent and not a destination capability.
```

## 4. Agent Execution Boundary

**Purpose:** Detail the boundary around `Agent Harness`, `Sandbox`, tools, secrets, filesystem, and external data access, using the supplied reference image as the closest composition.

```text
Create a landscape 3:2 technical interaction diagram, 1536x1024, closely matching the supplied reference image:
solid black canvas, floating warm-white rectangular cards, thin black outlines, pale-yellow operational cards,
black monospaced uppercase labels, and a fine grey dotted nested sandbox area.

On the left, place a wide white card: SERVER / AGENT HARNESS.
On the right, place a large white outer container titled SANDBOX.
Inside SANDBOX, draw a dotted inner container titled HARNESS.
Inside the dotted HARNESS container, stack two pale-yellow cards:
AGENT LOOP and MCP / TOOLS.
Below the dotted HARNESS container but still inside SANDBOX, place a white card: FILESYSTEM.

Below the left server card, place a white card: MODEL GATEWAY.
Below the right sandbox container, place a white card: GATEWAY SERVICE.
Inside GATEWAY SERVICE, place a pale-yellow card: SECRETS.
At the bottom center, place a white card: DATA / APIS.

Use only these arrows:
SERVER / AGENT HARNESS -> AGENT LOOP
AGENT LOOP -> MCP / TOOLS
MCP / TOOLS -> FILESYSTEM
MCP / TOOLS -> GATEWAY SERVICE
GATEWAY SERVICE -> DATA / APIS
SERVER / AGENT HARNESS -> MODEL GATEWAY

Use small thin line icons: loop arrows for AGENT LOOP, tool icon for MCP / TOOLS,
file/code icon for FILESYSTEM, lock for SECRETS, globe for DATA / APIS.
Make the SANDBOX boundary unambiguous. Do not draw any direct AGENT LOOP -> DATA / APIS arrow.
No extra labels, no vendor logos, no cloud graphics, no 3D.
```

## 5. Authorized Knowledge Retrieval

**Purpose:** Show the order of identity, authorization, retrieval, evidence, and grounded response without mixing in unrelated workflows.

```text
Create a landscape 3:2 authorized knowledge retrieval interaction diagram, 1536x1024, following the supplied style:
solid near-black canvas, warm-white outlined cards, pale-yellow active cards, black monospaced uppercase labels,
thin grey orthogonal connectors, and generous whitespace.

From left to right, place these cards in one clear path:
USER / CALLER CONTEXT -> RETRIEVAL REQUEST -> AUTHORIZED RETRIEVAL -> EVIDENCE WITH CITATIONS -> AGENT RUNTIME -> GROUNDED ANSWER.
Use pale-yellow cards only for AUTHORIZED RETRIEVAL and AGENT RUNTIME.

Above RETRIEVAL REQUEST and AUTHORIZED RETRIEVAL, place a white governance card:
IDENTITY AND AUTHORIZATION.
Connect it down to AUTHORIZED RETRIEVAL, not to the final answer.

Below RETRIEVAL REQUEST, place a white source group titled KNOWLEDGE DATA PLANE.
Inside it, show three small cards:
KNOWLEDGE SOURCE, CONTENT CATALOG, INDEX / EMBEDDING.
Connect KNOWLEDGE DATA PLANE to AUTHORIZED RETRIEVAL with one arrow labeled FILTER BY POLICY.

Below the whole path, place a wide white audit card: AUDIT TRACE.
Connect AUTHORIZED RETRIEVAL, EVIDENCE WITH CITATIONS, AGENT RUNTIME, and GROUNDED ANSWER down to AUDIT TRACE.

Add one small annotation near the retrieval boundary: NO UNAUTHORIZED CONTEXT.
Make it visually impossible for raw INDEX / EMBEDDING output to bypass AUTHORIZED RETRIEVAL.
No vector database logo, no data lake illustration, no answer-first shortcut.
```

## 6. Cross-Domain Task

**Purpose:** Show how an HR task can use Finance semantics without duplicating Finance data or creating an uncontrolled chatbot chain.

```text
Create a landscape 3:2 cross-domain task interaction diagram, 1536x1024, in the supplied black-canvas schematic style:
warm-white rectangular cards, pale-yellow active cards, thin black outlines, black monospaced uppercase labels,
thin grey orthogonal arrows, sparse composition, and no decorative background objects.

Draw one large outlined boundary titled REGIONAL DEPLOYMENT.
Inside it, place a left-to-right path:
HR COPILOT -> HR AGENT -> SHARED DATA CONTRACT -> FINANCE WORKFLOW -> GOVERNED RESULT -> HR AGENT.
Use pale-yellow cards for HR AGENT, SHARED DATA CONTRACT, and FINANCE WORKFLOW.

Above SHARED DATA CONTRACT, place a white card: SHARED KNOWLEDGE BASE CONTENT.
Connect it to HR AGENT and FINANCE WORKFLOW with thin dashed grey lines.

Above the whole path, place a white control strip:
IDENTITY CONTEXT / AUTHORIZATION / POLICY / TRACE.
Connect this strip to HR AGENT, SHARED DATA CONTRACT, and FINANCE WORKFLOW with thin vertical lines.

On the far right, outside the regional boundary, place a muted white card: LEGACY CHATBOT.
Draw a dashed blocked arrow from LEGACY CHATBOT toward the main path labeled NOT THE SHARING CONTRACT.

Add a small annotation at the bottom:
SHARED SEMANTICS, CONTROLLED ACCESS, NO DATA DUPLICATION.
The diagram must show that the HR Agent consumes an authoritative contract or approved Tool / Workflow result,
not an arbitrary Finance Chatbot conversation. Do not draw recursive Agent / Bot arrows.
```

## Terminology Note

All labels above are visual working terms derived from the current concept map. They do not establish new canonical API or data-model names. Annotations such as `NO UNBOUNDED AGENT / BOT CHAIN`, `FILTER BY POLICY`, and `NOT THE SHARING CONTRACT` are explanatory diagram text only.
