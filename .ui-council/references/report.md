# Council report: calibration

**Status:** SCORED · overall 8.42

## Scores

| module | uiux (weighted) | uiux opus | uiux luna | uiux glm | uiux gemini |
|---|---|---|---|---|---|
| t3-code | 8.54 | 8.25 | 8.65 | 8.75 | 8.8 |
| codex | 8.42 | 8.25 | 8.85 | 8.25 | 8.55 |
| claude-code | 7.74 | 7.4 | 7.9 | 8.25 | 7.9 |
| linear | 8.97 | 8.75 | 8.8 | 8.75 | 9.5 |

## Findings by module

### t3-code (uiux 8.54)

**Strengths**

- [opus] One shell for every secondary module: settings and usage open in the same centered panel with a breadcrumb header, a close button and the same bordered card groups, so a non-chat screen feels native to the chat app.
- [opus] Settings rows follow a single pattern (bold label, one-line muted description, control right-aligned) inside titled section cards; the whole page scans top to bottom without reading.
- [opus] Numbers lead: usage shows '88% left' in large type first, with bars, reset countdowns and deltas as secondary detail. This is the right model for cash-flow and bills summaries.
- [opus] Sidebar rows pack status into compact metadata (project tag, relative time, 'Waiting 28m', provider badge) while the title stays the dominant line.
- [opus] The empty state is a direct question plus the composer, centered, so the next action is unmistakable.
- [luna] Keep workspace and thread navigation in a persistent rail, separate from the active task.
- [luna] Make the new-thread composer the clear focal point and keep project context controls close at hand.
- [luna] Group settings into labeled sections, with short explanations and controls aligned consistently.
- [luna] Pair usage percentages with provider-specific bars and reset timing for quick scanning.
- [glm] Every sidebar thread carries status and time metadata (Waiting 28m, 7h), making the list scannable and trustworthy at a glance
- [glm] New-thread screen focuses all attention on one headline plus one composer; everything else recedes into quiet surfaces
- [glm] Settings rows follow one strict pattern — title, one-line explanation, right-aligned control — grouped into rounded cards with labeled sections
- [glm] Usage screen scales data well: huge percentage numbers anchor each row, then per-environment segments and time-remaining chips layer detail on top
- [glm] Keyboard and safety affordances are surfaced, not hidden: a / hint on search and an explicit delete-confirmation toggle
- [gemini] Pure dark palette with subtle border delimiters instead of heavy solid cards, creating an immersive, focused workspace.
- [gemini] Rich contextual composer encapsulating file attachment chips, model selection, and branch/checkout status without clutter.
- [gemini] Segmented progress visualizations for quotas with clear countdown timers and multi-tenant attribution.
- [gemini] Clean split-pane settings layout with search, breadcrumb navigation, and concise explanatory subtext under each toggle.

**Issues**

- **medium** · [opus] `usage-limits.png`: The bar encoding has no legend: the white vertical marker, the hatched tail, two different hues per row and a gray Codex bar all carry meaning the user has to guess. → Label the marker (e.g. 'expected pace') and the hatched region, keep one hue per account, and add a small legend or tooltip on first use.
- **medium** · [opus] `new-thread.png`: The floating top-right panel (user, Open in Zed, Add project script, branch) sits detached on an empty canvas and repeats the user and branch already shown under the composer. → Fold it into the composer footer or a header popover so context lives in one place next to the action it affects.
- **medium** · [opus] `settings.png`: On a pure-black canvas the small gray descriptions and the off-state toggles have weak contrast; the off toggle almost disappears into the card. → Use a near-black base with slightly raised card surfaces, lift secondary text contrast, and give the off toggle a visible track border.
- **medium** · [luna] `settings.png`: The header says Settings / General while Diffs & pull requests is highlighted in the navigation, so the current location is ambiguous. → Keep the selected navigation item and the settings page title in sync.
- **medium** · [glm] `usage-limits.png`: The hatched (striped) bar regions and small trend arrows beside 'left' percentages have no legend, so a first-time reader cannot tell what the pattern or arrow means → Add a one-line legend under the segmented control, or a tooltip on first hover, explaining hatched regions and the trend arrow
- **low** · [opus] `settings.png`: 'General' (selected) and 'Diffs & pull requests' (hovered) carry nearly identical fills, so the current page is not clearly distinguished; the last nav group (Maintenance, Labs, About, Archive) has no group header unlike the others. → Give the selected item a stronger fill or an accent bar, and either label the last group or separate it consistently.
- **low** · [opus] `new-thread.png`: Sidebar footer controls are icon-only and 'Settled 573 ›' is cryptic; the three top-right layout icons are also unlabeled. → Add text labels or always-available tooltips and a clearer name for the settled count.
- **low** · [opus] `usage-limits.png`: 'Claude & GPT (shared) · Weekly' wraps to two lines and pushes its percentage down, breaking the left-column alignment every other card keeps. → Truncate or shorten the label, or widen the label column so all cards align on the same baseline.
- **low** · [gemini] `new-thread.png`: Cryptic colored status badges (such as MC and PC icons) in sidebar threads lack explicit textual meaning or onboarding tooltips. → Add descriptive tooltips on hover and consider standardizing status indicators with human-readable labels.
- **low** · [gemini] `settings.png`: Setting subsections have long vertical lists of toggles with minimal visual rhythm, making scanning fatigue likely. → Use subtle card enclosures or alternating row backgrounds to group related controls into clear visual clusters.
- **low** · [glm] `usage-limits.png`: Labels like 'Match<IT> Claude 89%' run tight inside their bar segments and nearly clip at the divider → Truncate labels to the segment width with ellipsis and show the full label on hover
- **low** · [glm] `new-thread.png`: The bottom-left footer ('Settled 573' plus three tiny icons) is unexplained and its icons are too small to be confident targets → Add tooltips and enlarge the hit areas, or group the footer into one labeled status chip
- **low** · [glm] `settings.png`: The right control column mixes full-width dropdowns with small toggles, leaving a slightly ragged right edge across rows → Reserve a fixed-width control column so toggles and dropdowns align on one edge

### codex (uiux 8.42)

**Strengths**

- [opus] Calm conversation layout: the user's message in a soft bubble on the right, the assistant's text unboxed at a comfortable line length, and tool work collapsed into a single 'Trabalhou por 8s ›' line.
- [opus] The same shell carries non-chat modules: the image gallery keeps the icon rail, the page title style and the same composer, so a content grid and a chat read as one product.
- [opus] Restraint: one neutral dark gray, almost no accent color, hierarchy carried by size and weight; nothing competes with the content.
- [opus] Plain sectioned sidebar (Fixados, Projetos, Recentes) with quiet labels makes wayfinding simple even with a long history.
- [opus] Per-message actions (copy, feedback, read aloud, more) sit as tiny muted icons under the reply, available without cluttering the text.
- [luna] Use restrained surfaces and clear spacing to keep a long conversation readable without visual clutter.
- [luna] Keep navigation, the active conversation, and output sources distinct while making them feel like one workspace.
- [luna] Use a consistent image grid with strong previews and labels that stay legible over varied artwork.
- [luna] Anchor the composer at the bottom so the next action remains available while browsing or reading.
- [glm] Machine effort is summarized, not dumped: 'Trabalhou por 8s' collapses the whole work phase into one expandable line
- [glm] Inline code chips (rebase, squash, cherry-pick) make technical tokens visually distinct without breaking reading flow
- [glm] Gallery cards carry their label on a bottom gradient overlay, keeping the grid uniform while every image stays named
- [glm] The composer doubles as a command surface: attachments, custom tools, model/effort picker, and mic in one calm row
- [glm] Near-monochrome surfaces with one restrained accent keep the content, not the chrome, in charge
- [gemini] Right-side auxiliary rail for results and sources keeps the main conversational thread focused and uncluttered.
- [gemini] Collapsed thought/execution logs ('Trabalhou por 8s') preserve transparency while keeping reasoning unobtrusive.
- [gemini] Image gallery with bottom dark gradient scrims delivers consistent text legibility over diverse user-generated visual assets.
- [gemini] Persistent floating composer anchored to the bottom provides a predictable interaction model across chat and media views.

**Issues**

- **medium** · [opus] `conversation.png`: Sidebar titles are hard-clipped mid-word ('certidão do meu imó', 'verso', 'buscar e') with no ellipsis or fade, which looks broken in a list of thirty rows. → Apply an ellipsis or a fade mask at the edge and show the full title on hover.
- **medium** · [opus] `images-gallery.png`: The floating composer sits directly on the image grid with no scrim, covering the bottom of the third row and competing with the photos behind it. → Add a bottom gradient or solid dock behind the composer and bottom padding so the last row can scroll clear of it.
- **medium** · [opus] `conversation.png`: The left icon rail (seven icons) has no labels, and the right 'Resultados / Fontes' card has an unclear purpose with a very faint empty-state line. → Label the rail or show tooltips, and give the side card a one-line explanation and a visible call to action.
- **medium** · [gemini] `images-gallery.png`: The floating bottom prompt composer overlaps and obscures the bottommost row of content in the gallery grid. → Add dynamic bottom scroll padding or a safe-area footer spacer to ensure all content scrolls completely above the floating input.
- **medium** · [glm] `images-gallery.png`: The floating composer overlaps the third row of images, hiding gallery content while the user is browsing → Dock the composer in its own footer band, or collapse it to a small pill that expands on focus while scrolling
- **medium** · [glm] `conversation.png`: The sidebar thread list shows plain truncated titles with no timestamps or status, so recent conversations are hard to tell apart → Add relative time and a small state marker to each thread row, as the pinned section already hints at
- **low** · [opus] `images-gallery.png`: Captions on light images ('Esboço', 'Figurinhas') rely on a faint gradient, so legibility varies card by card. → Use a stronger, consistent scrim or place the caption below the image.
- **low** · [opus] `images-gallery.png`: The thread sidebar disappears on the gallery while it is present in the conversation, so the navigation model changes between modules. → Keep the same navigation chrome across modules, or make the collapse an explicit, consistent toggle.
- **low** · [opus] `conversation.png`: The composer placeholder and the disabled send button are very low contrast against the input surface. → Raise placeholder and disabled-icon contrast to at least 3:1 for the control.
- **low** · [gemini] `conversation.png`: The right panel in its empty state presents plain cards with faint borders that look unpolished compared to the central thread. → Add subtle empty-state illustrations, clear descriptive placeholders, or collapse the panel when no artifact or source is selected.
- **low** · [luna] `conversation.png`: Long conversation titles are truncated in the sidebar, making similarly named threads harder to distinguish at a glance. → Expose the full title on focus or hover, or add a small amount of secondary identifying context.
- **low** · [glm] `conversation.png`: The top-right 'Resultados' panel floats without a visible anchor, so its relationship to the current thread is ambiguous → Give the panel a header that names the thread, or visually connect it to the message that produced it
- **low** · [glm] `images-gallery.png`: The thin icon-only left rail has no labels, so discovering Library, History, or Sources depends on guessing → Reveal text labels on hover or offer an expandable rail state

### claude-code (uiux 7.74)

**Strengths**

- [opus] Progressive disclosure of agent work: each batch of tool calls collapses to one muted summary line ('Usou Claude Docs 6 vezes ▸') that can be expanded, so the transcript stays readable.
- [opus] A context side panel of key/value rows (Ambiente, Contexto with an 85% meter, Conectores, Saídas) gives glanceable state without leaving the conversation.
- [opus] Typographic voice: serif for the assistant's prose and sans for interface chrome clearly separates content from controls.
- [opus] Outputs are first-class objects: listed under 'Saídas' and linked inline, opening in a panel beside the chat instead of replacing it.
- [opus] Collapsible project groups in the sidebar keep a long thread list manageable.
- [luna] Let users keep the conversation, working context, and artifact in view at the same time.
- [luna] Use clear panel boundaries and compact labels to show which workspace each control belongs to.
- [luna] Keep the message composer fixed at the bottom of the conversation for a predictable next step.
- [glm] Tool activity is folded into one-line collapsible summaries ('Usou Claude Docs 6 vezes, Carregou ferramentas'), keeping the transcript readable
- [glm] The side panel exposes system state the user would otherwise guess: context percentage, connectors needing reconnection, environment list
- [glm] Empty and error states say what happened in words ('Este artefato foi excluído ou não está mais disponível') instead of going blank
- [glm] User turns as soft cards versus plain assistant text give turn ownership without heavy chat bubbles
- [glm] The left nav groups threads by project and environment, matching how the work is actually organized
- [gemini] Dedicated runtime inspector showing active environments, context percentage meter, and connected tools in real time.
- [gemini] Collapsible tool execution summaries ('Usou Claude Docs', 'Executou 1 comando') prevent lengthy shell/tool outputs from overwhelming the stream.
- [gemini] In-line artifact linking seamlessly paired with a persistent side panel for viewing generated documents side-by-side with conversation.
- [gemini] Structured multi-project and environment hierarchy in the sidebar for complex multi-repo workspaces.

**Issues**

- **high** · [opus] `conversation-with-panel.png`: A raw '<artifact-view-context>' JSON payload is rendered inside a user message bubble; internal plumbing leaks into the conversation. → Hide machine-attached context or render it as a compact chip such as 'Viewing decisoes-do-port'.
- **high** · [gemini] `conversation-with-panel.png`: Raw internal XML/JSON markup (<artifact-view-context ...>) leaks directly into the chat transcript, disrupting visual polish. → Filter or parse technical context payloads into formatted UI metadata cards or hidden debug traces.
- **medium** · [opus] `conversation-with-panel.png`: The artifact pane takes about a third of the width to show only 'Este artefato foi excluído ou não está mais disponível', with no way forward. → Auto-collapse the pane for a missing artifact, or offer actions (close, open another output, recreate).
- **medium** · [opus] `conversation-with-panel.png`: Four columns at once (sidebar, chat, info panel, artifact) squeeze the conversation into a narrow column and make the screen feel crowded. → Make the info panel and the artifact pane share one slot with tabs, or let one collapse automatically when the other opens.
- **medium** · [gemini] `conversation-with-panel.png`: Deleted or unavailable artifact states in the right pane provide no recovery actions, re-run prompts, or contextual explanation. → Provide a clear 'Regenerate artifact' button and display a brief explanation linking back to the originating prompt.
- **medium** · [luna] `conversation-with-panel.png`: The artifact pane reports that the artifact was deleted or is unavailable, but gives no recovery action or way to find another artifact. → Offer a clear next step, such as reopening the artifact list or returning to the conversation that created it.
- **medium** · [glm] `conversation-with-panel.png`: 'Conectores · 2 para reconectar' reports a problem as plain text with no adjacent action to fix it → Inline a 'Reconectar' button or link that takes the user straight to the reconnect flow
- **low** · [opus] `conversation-with-panel.png`: The scroll-to-bottom button lands on top of message text with no backdrop. → Give it a solid surface and shadow, or anchor it just above the composer.
- **low** · [opus] `conversation-with-panel.png`: Six icon-only buttons in the header and tiny disclosure triangles on sidebar groups (MATCH, transform-it, WAY) give weak affordance. → Add tooltips or labels and larger, clearer disclosure targets.
- **low** · [glm] `conversation-with-panel.png`: The panel's top icon strip (list, terminal, file, globe, folder) is icon-only and its meanings are not obvious → Label the active tab and add tooltips for the rest
- **low** · [glm] `conversation-with-panel.png`: Collapsed activity lines use very low-contrast gray that approaches the legibility floor → Raise the secondary text one contrast step while keeping the hierarchy
- **low** · [glm] `conversation-with-panel.png`: With the artifact unavailable, the right panel is mostly empty space beside a full transcript → Offer the remaining 'Saídas' artifacts as selectable content inside the panel so the space stays useful

### linear (uiux 8.97)

**Strengths**

- [opus] Hierarchy through restraint: one large title, muted metadata, and color only where it means something (yellow status icon, green/red diff counts, the star).
- [opus] The activity timeline uses two weights: system events as single muted lines, human comments as bordered cards, so importance is visible before reading.
- [opus] The agent lives in a contextual panel attached to the work object, and its result is a structured card (Changed 2 files +22 −10, Draft PR, branch) rather than a paragraph.
- [opus] Precise alignment and a consistent border, radius and spacing scale across sidebar, header, cards and panel; keyboard-style navigation (1/84 with up and down arrows) signals speed.
- [opus] Sidebar sections (Workspace, Favorites) with small distinct icons scan quickly without heavy color.
- [luna] Keep issue metadata, discussion, and agent work visible together so automation stays tied to its task.
- [luna] Use concise status labels and a clear activity timeline to show what changed and when.
- [luna] Give the agent panel a distinct boundary and keep its prompt and changed-file summary in one place.
- [glm] The agent panel closes the whole loop in one view: prompt, worked-for duration, plain-language summary, diff stats, draft PR with branch, and a reply box
- [glm] The activity feed narrates state transitions with actors and relative time (created via Slack, moved Todo to In Progress), so history reads like a story
- [glm] Diff numbers (+22 −10) use red/green color coding that needs no legend
- [glm] A Favorites section puts the user's active work one persistent click away in the sidebar
- [glm] Issue context stays visible in one toolbar row: ID, title, star, pagination (1/84), and prev/next navigation
- [gemini] Agent actions (branch creation, PR generation, status transitions) are integrated natively into the issue activity timeline alongside human collaboration.
- [gemini] Docked agent assistant panel provides full autonomous task monitoring, diff stats (+22 -10), and review actions without leaving context.
- [gemini] Masterful typographic scale, subtle high-contrast accents, and micro-borders create an exceptionally clean and legible interface.
- [gemini] Tight coupling of git workflow primitives (Draft PR, Revert, branch names) directly within ticket state management.

**Issues**

- **medium** · [opus] `issue-with-agent.png`: The agent panel floats over the activity column: comment cards and the Reviews area are cut off underneath, so the user cannot read the thread and the agent side by side. → Dock the panel as a resizable side pane that pushes content, or narrow the activity column when it opens.
- **medium** · [glm] `issue-with-agent.png`: The issue toolbar's five actions are icon-only with no labels, so their meaning is guessable but not certain → Add tooltips and gather the rarer actions into an overflow menu with labeled entries
- **low** · [opus] `issue-with-agent.png`: Small gray metadata (timestamps, 'connected by', system events) is low contrast on the dark surface. → Lift the muted text token one step while keeping it below body text.
- **low** · [opus] `issue-with-agent.png`: The header action row (link, copy, branch, assign, dropdown) is icon-only. → Provide tooltips with shortcut hints or a labeled overflow menu.
- **low** · [opus] `issue-with-agent.png`: The agent panel leaves a large empty gap between the diff card and the reply box. → Let the panel height fit its content, or anchor the composer closer to the last message.
- **low** · [gemini] `issue-with-agent.png`: The floating docked agent card overlays issue comments and activity timeline on medium or smaller desktop viewports. → Provide a quick toggle to dock the agent card into a collapsible side column or split-pane layout.
- **low** · [luna] `issue-with-agent.png`: The agent panel's run details and changed-file summary are dense in a narrow dock, so important review text is visually small. → Allow the agent panel to expand or resize for reviewing longer run summaries and file changes.
- **low** · [glm] `issue-with-agent.png`: Activity and comment text runs small; on a long issue the feed would strain scanning → Bump the base size slightly or offer a comfortable-density option
- **low** · [glm] `issue-with-agent.png`: The reply composer's 'Skills' dropdown and its refresh, attach, and send buttons are all unlabeled icons → Tooltips on the icons and a visible label state for Skills when a skill is selected

## Overall impressions

- [opus] All four share the same backbone: a neutral near-black palette with almost no accent color, hierarchy carried by type size and weight instead of decoration, a persistent left sidebar with plain grouped sections, one composer pattern reused wherever the user can act, and secondary screens (settings, usage, gallery, side panels) built from the same shell, borders and spacing so every module feels like the same product. They hide machine work behind one-line summaries and surface results as structured cards or big numbers. For The Chatbot's non-chat modules (todos, notes, artifacts, cash flow, bills), the transferable recipe is T3's settings rows and usage 'big number first' cards plus Linear's two-weight timeline and structured result cards. What not to copy: unlabeled icon-only controls, low-contrast gray secondary text and panels that cover content. Every reference shown is dark mode only, so light-mode quality must come from the same token structure rather than from these screens.
- [luna] These apps share a calm, dark workspace built from clear navigation, restrained separators, and strong type hierarchy. Each keeps one primary task in focus while leaving nearby controls available for context. Their most transferable pattern is to show related work side by side without losing the user's place, then keep the next action easy to find.
- [glm] Restraint plus status honesty. All four apps sit on near-monochrome dark surfaces with one or two meaningful accents, so color always means something — usage levels, diff stats, state markers — never decoration. Hierarchy is typographic: one big anchor per screen (a headline, a 99%, an issue title) and everything else stepped down through consistent grays. Machine activity is never dumped raw; it is folded into collapsible summaries ('worked for 8s', 'Usou Claude Docs 6 vezes') while system state (context %, connectors, usage windows) is promoted to first-class content. A persistent composer anchors each screen as the obvious next action, and nearly every item carries time metadata (7h, 2 min ago, 10d 22h) so the user can trust what they are looking at. Layers separate through hairline borders and surface tints instead of heavy shadows, which is what keeps these dense screens calm.
- [gemini] These apps succeed by treating AI not as an isolated chat bubble, but as an integrated workspace participant. They pair dark, low-distraction canvases and disciplined typography with dedicated side panels or docked inspectors for artifacts, tools, and execution context, keeping long-form conversational feeds clean and actionable.
