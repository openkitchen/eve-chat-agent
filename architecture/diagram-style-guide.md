# Architecture Diagram Visual Style Guide

## Reference Rule

The supplied `style_ref.svg` is the strict visual reference for card geometry, typography, icon weight, nested containment, and the dotted `Harness` boundary. Its black screenshot background is not a required rule: generated diagrams must use a pure white canvas. Treat it as a component board, not as general inspiration for an architecture infographic.

The SVG converts all text to paths, so its original font family cannot be recovered reliably. Do not claim a named font is exact. Match the observable compact, crisp, mechanically typeset label character instead.

## Visual Grammar

- Use a pure white canvas: `#FFFFFF`.
- Place a small number of isolated white cards on the canvas. Preserve large, intentional white negative-space areas between card groups; card borders provide the separation.
- Express structure primarily with position, alignment, and containment. A large white `SANDBOX` container can contain a dotted `HARNESS` area and smaller cards. Do not use arrows to explain every relationship.
- Use only three visual materials: white canvas and cards, black outlines/type/icons, and pale-yellow active cards. The dotted pattern is reserved for a bounded inner execution area.
- The diagram is flat and precise. It is neither hand-drawn, editorial, playful, illustrative, nor a presentation slide.

## Layout

- Default to the reference `500 x 665` portrait proportion, approximately `3:4`. Do not switch to a wide landscape canvas unless a specific diagram request explicitly requires it.
- Use no overall headline, subtitle, explanatory paragraph, side note, sticky note, legend, logo, or decorative frame.
- Use 4 to 8 top-level card groups. Keep labels readable by splitting a large subject into another image instead of shrinking the type.
- Align cards to a simple invisible grid. Keep card sizes deliberate and stable; never stretch cards around long prose.
- Main cards are pure white: `#FFFFFF`, with approximately 1 px black borders and 3 px corner radius. They must not look like rounded pills, glass panels, or floating shadows.
- Active inner cards are pale yellow: `#FFF4C2`. Use this sparingly, only for the current runtime unit or active control point.
- A dotted `HARNESS`-style area uses tiny evenly spaced `#CCCCCC` dots on white. It is an execution boundary, not decoration.

## Typography

- Use compact, crisp, neutral, mechanically typeset label typography. It should look like a small system label, not handwriting.
- Prefer a narrow modern mono-like or fixed-width sans label face. Do not name or imitate a specific font unless the generator can reliably use it.
- Use black text on light cards. Most labels are uppercase; nested sublabels may use short title case such as `Harness` or `Secrets`.
- Keep labels short, usually one line. Use modest letter spacing, uniform stroke weight, and no text jitter, marker texture, calligraphy, rounded playful letters, or oversized display type.
- Use no title larger than a normal card label.

## Icons

- Use at most one small black outline icon inside a card, positioned to the left of its label.
- Icons are functional and thin: loop arrow, tool, terminal/file, lock, or globe.
- Do not use large illustrations, people, brain graphics, cloud graphics, logos, vendor marks, emoji, or colourful pictograms.

## Connectors

### Concept and Deployment Boards

- Use no connectors by default.
- Show containment with nested cards and grouping. Show shared or governed relationships through alignment or a single small labelled boundary card.
- Do not add decorative arrows, dashed paths, or flowchart lines.

### Interaction Boards

- Use connectors only when the image's sole purpose is to show one concrete interaction path.
- Use at most 5 thin `#8F8F8F` orthogonal connectors. Use one small arrowhead only when direction is essential.
- Connectors may not cross labels, overlap cards, form loops, or become the visual focus.
- Keep the same white/black/yellow visual language. An interaction diagram must not switch to a timeline, coloured flowchart, or infographic style.

## Content Discipline

- Render only declared labels. Do not invent abstract narratives such as `Agent Brain`, `Infinite Impact`, or explanatory claims.
- Keep labels in English. Use the existing architectural terms consistently: `CONTROL PLANE`, `REGIONAL DEPLOYMENT`, `DOMAIN PACKAGE`, `AGENT RUNTIME`, `ROUTER`, `DELEGATION`, `MODEL GATEWAY`, `SANDBOX`, `KNOWLEDGE BASE SYSTEM`, `SHARED KNOWLEDGE BASE CONTENT`, and `SHARED DATA CONTRACT`.
- `Router` is not a universal super-agent. `Business Domain` is a package boundary, not a duplicate complete platform. `Region` is a deployment and data boundary.

## Absolute Exclusions

```text
No textured or off-white paper background, no black canvas, no hand-drawn font, no handwriting, no marker texture,
no large heading, no subtitle, no sticky notes, no explanatory callouts, no coloured section frames,
no cloud-provider logos, no vendor branding, no people, no brain illustration, no stock imagery,
no gradients, no 3D, no isometric view, no dashboard widgets, no glassmorphism, no neon glow,
no paper texture, no colourful infographic palette, no generic SaaS architecture poster,
no invented labels, no Chinese labels, no dense flowchart, and no decorative arrows.
```
