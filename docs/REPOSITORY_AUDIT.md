# Repository Audit

## Current diagnosis

### What the repository already does well

- The main product already lives in a clear app shape: `frontend/` + `backend/`
- There is a persistent data model and authenticated flows
- Project, task, artifact, observability, and implementation concepts already exist

### What made the repository feel like a lab

- too many loose files in the root
- root-level tests mixed with product code
- utility scripts mixed with entrypoint files
- experimental pipeline variants without a clear official path
- old naming still centered on a broad "AI Software Factory"
- outdated README and docs focused on full generation instead of alignment

### Entry points

- Product frontend: `frontend/src/App.jsx`
- Product backend: `backend/src/server.js`
- Legacy orchestration compatibility: `backend/src/routes/projectRoutes.js` + `orchestrator/factory.py`

### Canonical flow

The canonical flow is now the authenticated web product:

1. User describes an idea, feature, or need
2. Aligna analyzes clarity and ambiguity
3. The platform returns a structured requirement package before development

### Legacy and experimental areas

- `orchestrator/`: compatibility layer from the original broad factory
- `experiments/factory_optimized.py`: experimental variant moved out of the root
- `generated-projects/`: generated example output, not the core product

## Repository decisions

- `frontend/ + backend/` is the official product path
- loose root tests were moved to `tests/`
- loose maintenance files were moved to `scripts/maintenance/`
- loose Windows wrappers were moved to `scripts/windows/`
- experimental factory variant was moved to `experiments/`
- `.venv/` and `.cache/` were removed from version control and ignored
