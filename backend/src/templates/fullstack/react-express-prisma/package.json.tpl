{
  "name": "__PROJECT_SLUG__",
  "private": true,
  "version": "1.0.0",
  "workspaces": [
    "apps/*",
    "packages/*"
  ],
  "scripts": {
    "dev:web": "npm --workspace apps/web run dev",
    "dev:api": "npm --workspace apps/api run dev",
    "build:web": "npm --workspace apps/web run build",
    "build:api": "npm --workspace apps/api run build",
    "lint": "node scripts/lint.mjs",
    "test": "node scripts/test.mjs && node scripts/e2e-smoke.mjs"
  }
}
