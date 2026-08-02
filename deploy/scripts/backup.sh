#!/usr/bin/env bash
# 每日备份 fitbuddy 数据库，保留最近 14 份。用法：./scripts/backup.sh（在 deploy/ 下执行）
set -euo pipefail
cd "$(dirname "$0")/.."
mkdir -p backups
STAMP=$(date +%Y%m%d-%H%M%S)
docker compose exec -T postgres pg_dump -U postgres -Fc -d fitbuddy > "backups/fitbuddy-$STAMP.dump"
ls -1t backups/fitbuddy-*.dump 2>/dev/null | tail -n +15 | xargs -r rm --
echo "backup ok: backups/fitbuddy-$STAMP.dump"
