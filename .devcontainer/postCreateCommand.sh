# !/bin/bash
# Post create setup for Codespaces / Devcontainer

echo '🚀 Setting up Hivemind Predictor...'

# Install pnpm if not present
if ! command -v pnpm &> /dev/null; then
  echo 'Installing pnpm...'
  npm install -g pnpm
fi

# Install dependencies
pnpm install

# Setup .env if missing
if [ ! -f .env ]; then
  echo 'Creating .env from example...'
  cp .env.example .env
  # The PostgreSQL devcontainer feature uses these defaults
  echo 'DATABASE_URL="postgresql://postgres:postgres@localhost:5432/hivemind"' >> .env
fi

# Push database schema
echo '🔄 Pushing database schema...'
pnpm --filter @workspace/db run push || echo '⚠️  Schema push failed (this is often ok on first run)'

echo '✅ Setup complete!'
echo ''
echo 'Next steps:'
echo '  • Run: pnpm dev:all   (recommended if available)'
echo '  • Or start manually:'
echo '      Terminal 1: PORT=8080 pnpm --filter @workspace/api-server run dev'
echo '      Terminal 2: PORT=5173 BASE_PATH=/ pnpm --filter @workspace/hivemind run dev'