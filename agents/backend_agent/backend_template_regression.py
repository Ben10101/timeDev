# -*- coding: utf-8 -*-
from __future__ import annotations

import json
from pathlib import Path


REPO_ROOT = Path(__file__).resolve().parents[2]
GENERATED_APP_ROOT = REPO_ROOT / "generated-projects" / "plataforma-de-operacoes-de-visitas-corporativas"


REGRESSION_CASES = [
    {
        "name": "access_control_roles",
        "service": GENERATED_APP_ROOT / "apps/api/src/modules/access-control-roles/service.ts",
        "router": GENERATED_APP_ROOT / "apps/api/src/modules/access-control-roles/router.ts",
        "index": GENERATED_APP_ROOT / "apps/api/src/modules/access-control-roles/index.ts",
        "service_checks": [
            "from '@prisma/client'",
            "const prisma = new PrismaClient()",
            "async list()",
            "async create(",
            "export class",
            "export const",
            "return { items:",
            ".create({",
        ],
        "router_checks": [
            "Router()",
            ".get('/',",
            ".post('/',",
            "from './service'",
            "req.body",
            "res.status(201).json(created)",
        ],
        "index_checks": [
            "from './router'",
            "from './service'",
            "export {",
        ],
    },
    {
        "name": "visit_intake",
        "service": GENERATED_APP_ROOT / "apps/api/src/modules/visit-intake/service.ts",
        "router": GENERATED_APP_ROOT / "apps/api/src/modules/visit-intake/router.ts",
        "index": GENERATED_APP_ROOT / "apps/api/src/modules/visit-intake/index.ts",
        "service_checks": [
            "from '@prisma/client'",
            "const prisma = new PrismaClient()",
            "async list()",
            "async create(",
            "export class",
            "export const",
            "return { items:",
            ".create({",
        ],
        "router_checks": [
            "Router()",
            ".get('/',",
            ".post('/',",
            "from './service'",
            "req.body",
            "res.status(201).json(created)",
        ],
        "index_checks": [
            "from './router'",
            "from './service'",
            "export {",
        ],
    },
]


def _read_text(path):
    if not path.exists():
        return ""
    return path.read_text(encoding="utf-8")


def _check_file(path, required_fragments):
    content = _read_text(path)
    if not content.strip():
        return False, "missing_or_empty"
    missing = [fragment for fragment in required_fragments if fragment not in content]
    if missing:
        return False, missing
    return True, []


def run_backend_template_regression_suite():
    results = []
    failures = []

    for case in REGRESSION_CASES:
        service_ok, service_missing = _check_file(case["service"], case["service_checks"])
        router_ok, router_missing = _check_file(case["router"], case["router_checks"])
        index_ok, index_missing = _check_file(case["index"], case["index_checks"])

        case_failed = not (service_ok and router_ok and index_ok)
        if case_failed:
            failures.append(case["name"])

        results.append(
            {
                "name": case["name"],
                "passed": not case_failed,
                "service": {
                    "path": str(case["service"].relative_to(REPO_ROOT)),
                    "ok": service_ok,
                    "missing": service_missing,
                },
                "router": {
                    "path": str(case["router"].relative_to(REPO_ROOT)),
                    "ok": router_ok,
                    "missing": router_missing,
                },
                "index": {
                    "path": str(case["index"].relative_to(REPO_ROOT)),
                    "ok": index_ok,
                    "missing": index_missing,
                },
            }
        )

    return {
        "passed": not failures,
        "failures": failures,
        "cases": results,
    }


if __name__ == "__main__":
    summary = run_backend_template_regression_suite()
    print(json.dumps(summary, ensure_ascii=False, indent=2))
    raise SystemExit(0 if summary["passed"] else 1)
