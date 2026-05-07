#!/bin/bash
set -e
HUSKY=0 pnpm install --frozen-lockfile
pnpm --filter @workspace/db run push
pnpm --filter @workspace/api-server run build
