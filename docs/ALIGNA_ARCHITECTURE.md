# Aligna Architecture

## Canonical product surface

The official Aligna product is the authenticated web application composed of:

- `frontend/`: React + Vite experience
- `backend/`: Express + Prisma API and product services

This is the only flow that should be treated as the canonical product path for new work.

## Why this was chosen

This surface already contains the product qualities that matter for Aligna:

- authenticated multi-user access
- persisted projects, tasks, artifacts, and runs
- observability and governance endpoints
- room to expose a clear SaaS workflow around requirement alignment

## Legacy and experimental surfaces

These paths remain in the repository for compatibility or historical context, but they are **not** the main product:

- `orchestrator/`: legacy Python orchestration used by older generation flows
- `experiments/factory_optimized.py`: archived experiment from the broader factory phase
- `generated-projects/`: generated example output, useful as a demo artifact, not the core product

## Official product flow

Aligna is now centered on alignment before development:

1. User describes an idea, feature, or need
2. Aligna refines the request into a structured requirement package
3. Aligna returns:
   - user story
   - acceptance criteria
   - business rules
   - test scenarios
   - clarity score
   - ambiguity alerts

Broader software factory capabilities can remain available in supporting areas, but they are no longer the primary positioning of the product.
