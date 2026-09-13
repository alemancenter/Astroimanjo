#!/usr/bin/env bash
set -Eeuo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

echo "== post-merge setup: frontend dependencies =="
npm ci --prefer-offline --no-audit --no-fund

echo "== post-merge setup: Go dependencies =="
(
	cd "$ROOT_DIR/back"
	go mod download
)

echo "== post-merge setup: contract and static checks =="
npm run contract
npm run check

echo "== post-merge setup: backend compile check =="
(
	cd "$ROOT_DIR/back"
	CGO_ENABLED=0 GOFLAGS="-p=2" GOMAXPROCS=2 go build -trimpath -o /tmp/imanjo-api-post-merge ./cmd/server
	rm -f /tmp/imanjo-api-post-merge
)

if [[ "${POST_MERGE_MIGRATE:-0}" == "1" ]]; then
	echo "== post-merge setup: additive database migration =="
	(
		cd "$ROOT_DIR/back"
		go run ./cmd/server --migrate-only
	)
else
	echo "== post-merge setup: database migration skipped (set POST_MERGE_MIGRATE=1 explicitly) =="
fi

echo "== post-merge setup complete =="