#!/bin/sh
set -e

echo "🎾 Tennis Hub - Iniciando..."

# Rodar migrations do banco se DATABASE_URL estiver definido
if [ -n "$DATABASE_URL" ]; then
  echo "📦 Aplicando migrations..."
  cd /app/apps/web
  npx prisma migrate deploy 2>/dev/null || npx prisma db push --accept-data-loss 2>/dev/null || echo "⚠️  Migrations puladas (banco pode não estar pronto ainda)"
  cd /app
fi

echo "🚀 Iniciando servidor Next.js..."
exec "$@"
