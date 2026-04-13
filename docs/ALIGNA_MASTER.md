# Aligna Master Documentation

This is the canonical product document for Aligna.
All other Aligna-facing docs in this repository are now legacy pointers or compatibility notes.

## 1. What Aligna is

Aligna is an AI-assisted product alignment platform.
Its core purpose is to take a vague product idea and turn it into a structured, reviewable, and executable delivery package before implementation begins.

The product reduces ambiguity across:

- backlog creation
- requirement refinement
- QA planning
- architecture gating
- implementation handoff
- operational governance

## 2. Canonical product surface

The current official surface is the authenticated web application composed of:

- `frontend/` - React + Vite product UI
- `backend/` - Express + Prisma API and domain services
- `agents/` - specialized AI agents for backlog, requirements, QA, architecture, and development
- `orchestrator/` - runtime entry points for agent execution

The canonical user journey is:

1. sign in and enter a workspace
2. create or open a project
3. generate backlog from the project idea
4. refine stories through requirements and QA
5. gate architecture before implementation
6. hand off to code or generated app flows

The product is now centered on the project context, not a generic factory flow.
The main operational entry point is the project overview, where the project kanban, architecture gate, and next-action CTA live together.

## 3. Primary user surfaces

### Workspace

- `/workspace`
- `/workspace/team`

Workspace is where the user sees the product portfolio and team context.

### Projects

- `/projects`
- `/projects/:projectUuid`

This is the main operational entry point for a project.
The project overview is the canonical place to see status, next action, and the project kanban.

The current project kanban is a 7-lane board:

- `backlog`
- `todo`
- `in_progress`
- `in_review`
- `blocked`
- `qa`
- `done`

It is used to refine and move tasks inside the context of a specific project.

### Task detail

- `/projects/:projectUuid/tasks/:taskUuid`

Used to inspect a single story, its artifacts, processing history, and current state.

### Code Studio

- `/code-studio`

Used for technical handoff and implementation work after the architecture gate.

### Governance

- `/settings/ai`
- `/governance`

Used to configure AI providers, fallback behavior, readiness, auditability, and runtime health.

### Backlog and kanban views

- `/backlog`
- `/global-backlog`

These views expose the operational task board, but the project overview is the preferred contextual entry.
The current product flow no longer frames the board as a separate planning surface first; it is part of the project experience.

### Runtime API endpoints

The main operational API routes that matter for the current product flow are:

- `POST /api/agents/run`
- `POST /api/tasks/:taskUuid/requirements/run`
- `POST /api/tasks/:taskUuid/qa/run`
- `GET /api/observability/health`
- `GET /api/observability/ai`
- `GET /api/observability/runtime`
- `GET /api/observability/readiness`
- `GET /api/observability/audit`
- `GET /api/observability/governance`
- `GET /api/observability/history`
- `GET /api/observability/alerts`
- `GET /api/observability/pipeline`

These routes expose the actual runtime, not just the UI.

## 4. Core execution model

Aligna is built around a staged flow:

1. product idea
2. project and backlog creation
3. requirements refinement
4. QA planning
5. architecture validation
6. code handoff

The key distinction is that Aligna does not treat AI as a one-shot text generator.
It treats AI output as a staged artifact with persistence, validation, and operational metadata.

## 5. Artifact model

The main generated artifacts are:

- backlog
- requirements
- test plan
- architecture
- implementation/code output

Artifact quality is enforced through validation rules and shared completeness checks.

Current quality focus areas:

- backlog clarity
- requirements implementability
- QA traceability
- architecture depth
- consistent headings and canonical sections

The current artifact contract is more specific than the older broad-factory descriptions:

- `project_manager` must produce a structured backlog with capabilities, epics, release slices, and stories
- `requirements_analyst` must produce refined requirements with functional flows, exceptions, rules, and BDD acceptance criteria
- `qa_engineer` must produce a test plan with strategy, data, risks, non-functional coverage, acceptance traceability, smoke coverage, and functional cases
- `architect` must produce a deeper architecture package with observability, risk/trade-off analysis, contracts/integrations, and implementation sequence

These contracts are enforced in the runtime before persistence.

## 6. Agent model

The product uses specialized agents instead of a single generic prompt.
Main roles include:

- `project_manager`
- `requirements_analyst`
- `qa_engineer`
- `architect`
- `developer`
- supporting specialized agents for UI, backend, schema, debugging, and implementation

Operational rules:

- each agent run is tracked
- outputs are validated before persistence
- timeouts and recovery are part of the runtime contract
- failed runs should restore the task or leave coherent state
- duplicate or truncated closing markers are normalized when possible
- section headings are tolerated by alias when the semantic content is still correct

## 7. Runtime and observability

Aligna is not just product UI.
It also has a runtime layer with:

- agent run lifecycle tracking
- audit logs
- readiness checks
- runtime health
- budget and cost tracking
- stale run recovery
- failure visibility
- project and task scoped agent runs
- persisted artifacts with `isCurrent`/versioning semantics
- operational health views for AI, runtime, audit, and governance

The observability layer exists to make AI execution understandable and auditable instead of opaque.

## 8. Quality and maturity

Current maturity reading:

- architecture: strong
- UX: solid but still uneven in places
- backend: reliable enough for product work, still improving
- security: improving, not fully enterprise hardened
- operations: better than a demo, not yet fully mature
- documentation: strong
- product narrative: now centered on project alignment instead of a broad factory concept

The product already feels like a real platform, but not yet a fully hardened enterprise system.

Main weak points:

- quality variability in agent output
- operational fragility under provider/timeouts
- too many overlapping surfaces if not clearly framed
- some legacy docs and flows that can confuse new readers
- the docs must stay aligned with the canonical project-first flow or they become misleading quickly

## 9. Commercial positioning

Aligna should be presented as:

- an AI-assisted product alignment platform
- a system that reduces ambiguity before implementation
- a workflow platform for backlog, requirements, QA, governance, and technical handoff
- a project-first product with a canonical board inside the project overview

It should not be framed as:

- only a story generator
- only a chatbot
- only a generic software factory

Commercial value comes from:

- less rework
- clearer handoff
- earlier QA involvement
- better traceability
- more confidence to start implementation
- more trust in the runtime because the product contracts are explicit

## 10. Roadmap themes

The main product roadmap themes are:

- improve artifact quality gates
- strengthen QA and architecture depth
- reduce runtime fragility
- keep UX consistent across strategic screens
- align docs and runtime behavior
- increase operational confidence and readiness
- simplify overlapping entry points and make the project overview the obvious home for work

## 11. What is legacy

The repository still contains older or compatibility surfaces.
Those are useful for history and compatibility, but they are not the canonical product description.

Whenever a conflict exists, this document wins.

## 12. Code references

Useful code entry points:

- [frontend/src/App.jsx](./../frontend/src/App.jsx)
- [frontend/src/pages/ProjectOverviewPage.jsx](./../frontend/src/pages/ProjectOverviewPage.jsx)
- [frontend/src/components/ProjectTaskBoard.jsx](./../frontend/src/components/ProjectTaskBoard.jsx)
- [frontend/src/components/AppShell.jsx](./../frontend/src/components/AppShell.jsx)
- [backend/src/services/projectDataService.js](./../backend/src/services/projectDataService.js)
- [backend/src/controllers/agentController.js](./../backend/src/controllers/agentController.js)
- [backend/src/services/observabilityService.js](./../backend/src/services/observabilityService.js)
- [backend/src/utils/artifactQuality.js](./../backend/src/utils/artifactQuality.js)

## 13. Current recommendation

If you want the fastest mental model of Aligna, read this document first.
Everything else should be treated as supporting material or legacy context.
