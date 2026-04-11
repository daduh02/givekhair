#!/bin/bash
# ─────────────────────────────────────────────────────────────────────────────
# giveKhair — one-shot deploy script
# Run: chmod +x deploy.sh && ./deploy.sh
# ─────────────────────────────────────────────────────────────────────────────

set -e  # exit on any error

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
BOLD='\033[1m'
NC='\033[0m' # no colour

divider() { echo -e "\n${BLUE}──────────────────────────────────────────${NC}"; }
step()    { echo -e "\n${BOLD}${GREEN}▶ $1${NC}"; }
info()    { echo -e "  ${YELLOW}→${NC} $1"; }
success() { echo -e "  ${GREEN}✓${NC} $1"; }
error()   { echo -e "  ${RED}✗ ERROR:${NC} $1"; exit 1; }
ask()     { echo -e "\n${BOLD}$1${NC}"; }

# ─────────────────────────────────────────────────────────────────────────────
# 0. INTRO
# ─────────────────────────────────────────────────────────────────────────────
clear
echo -e "${GREEN}${BOLD}"
echo "   ██████╗ ██╗██╗   ██╗███████╗██╗  ██╗██╗  ██╗ █████╗ ██╗██████╗ "
echo "  ██╔════╝ ██║██║   ██║██╔════╝██║ ██╔╝██║  ██║██╔══██╗██║██╔══██╗"
echo "  ██║  ███╗██║██║   ██║█████╗  █████╔╝ ███████║███████║██║██████╔╝"
echo "  ██║   ██║██║╚██╗ ██╔╝██╔══╝  ██╔═██╗ ██╔══██║██╔══██║██║██╔══██╗"
echo "  ╚██████╔╝██║ ╚████╔╝ ███████╗██║  ██╗██║  ██║██║  ██║██║██║  ██║"
echo "   ╚═════╝ ╚═╝  ╚═══╝  ╚══════╝╚═╝  ╚═╝╚═╝  ╚═╝╚═╝  ╚═╝╚═╝╚═╝  ╚═╝"
echo -e "${NC}"
echo -e "  ${BOLD}Automated deploy script${NC}"
echo -e "  This will deploy giveKhair to Vercel + Supabase + Upstash\n"
echo -e "  You will need accounts at:"
echo -e "    • github.com     (free)"
echo -e "    • supabase.com   (free)"
echo -e "    • upstash.com    (free)"
echo -e "    • vercel.com     (free)\n"
echo -e "  ${YELLOW}Estimated time: ~15 minutes${NC}"

divider
ask "Press ENTER to start, or Ctrl+C to cancel."
read -r

# ─────────────────────────────────────────────────────────────────────────────
# 1. CHECK PREREQUISITES
# ─────────────────────────────────────────────────────────────────────────────
step "1/7 — Checking prerequisites"

check_cmd() {
  if command -v "$1" &>/dev/null; then
    success "$1 found ($(command -v "$1"))"
  else
    error "$1 is not installed. Please install it and re-run.\n       See: $2"
  fi
}

check_cmd node   "https://nodejs.org"
check_cmd npm    "https://nodejs.org"
check_cmd git    "https://git-scm.com"

# Node version check
NODE_VER=$(node -e "process.exit(parseInt(process.versions.node) < 20 ? 1 : 0)" 2>/dev/null && echo "ok" || echo "old")
if [ "$NODE_VER" = "old" ]; then
  error "Node.js 20+ required. Current: $(node -v)\n       Install via: https://nodejs.org or nvm"
fi
success "Node.js version OK ($(node -v))"

# Install Vercel CLI if missing
if ! command -v vercel &>/dev/null; then
  info "Installing Vercel CLI..."
  npm install -g vercel
  success "Vercel CLI installed"
else
  success "Vercel CLI found"
fi

# ─────────────────────────────────────────────────────────────────────────────
# 2. COLLECT CREDENTIALS
# ─────────────────────────────────────────────────────────────────────────────
step "2/7 — Collecting service credentials"
echo -e "  I'll ask for each credential. Open each service in your browser.\n"

# ── Supabase ──
divider
echo -e "${BOLD}  SUPABASE — PostgreSQL database${NC}"
echo -e "  1. Go to: ${BLUE}https://supabase.com${NC}"
echo -e "  2. Sign up / log in → click ${BOLD}New project${NC}"
echo -e "  3. Choose a name (e.g. givekhair), set a strong DB password, pick ${BOLD}West EU (Ireland)${NC} region"
echo -e "  4. Wait ~2 minutes for the project to provision"
echo -e "  5. Go to: ${BOLD}Settings → Database${NC}"
echo -e "  6. Scroll to ${BOLD}Connection string${NC} → select ${BOLD}URI${NC} tab"
echo -e "  7. Switch the toggle to ${BOLD}Session mode (port 5432)${NC}"
echo -e "  8. Copy the full URI (it starts with postgresql://postgres...)\n"

ask "Paste your Supabase DATABASE_URL here:"
read -r DATABASE_URL
if [[ ! "$DATABASE_URL" == postgresql* ]] && [[ ! "$DATABASE_URL" == postgres* ]]; then
  error "That doesn't look like a PostgreSQL URL. It should start with postgresql://"
fi
success "Supabase URL saved"

# ── Upstash ──
divider
echo -e "${BOLD}  UPSTASH — Redis (for background jobs)${NC}"
echo -e "  1. Go to: ${BLUE}https://upstash.com${NC}"
echo -e "  2. Sign up / log in → click ${BOLD}Create database${NC}"
echo -e "  3. Name it ${BOLD}givekhair${NC}, select ${BOLD}EU-West-1 (Ireland)${NC}, leave TLS enabled"
echo -e "  4. After creation, click the database → scroll to ${BOLD}REST API${NC} section"
echo -e "  5. Copy the ${BOLD}REDIS_URL${NC} (starts with rediss://)\n"

ask "Paste your Upstash REDIS_URL here:"
read -r REDIS_URL
if [[ ! "$REDIS_URL" == redis* ]]; then
  error "That doesn't look like a Redis URL. It should start with redis:// or rediss://"
fi
success "Upstash URL saved"

# ── GitHub ──
divider
echo -e "${BOLD}  GITHUB — Source code hosting${NC}"
echo -e "  1. Go to: ${BLUE}https://github.com/new${NC}"
echo -e "  2. Create a ${BOLD}private${NC} repository named ${BOLD}givekhair${NC}"
echo -e "  3. Don't initialise with README (we'll push existing code)"
echo -e "  4. Copy the repository URL (e.g. https://github.com/yourname/givekhair.git)\n"

ask "Paste your GitHub repository URL:"
read -r GITHUB_URL
if [[ ! "$GITHUB_URL" == *github.com* ]]; then
  error "That doesn't look like a GitHub URL."
fi
success "GitHub URL saved"

# ─────────────────────────────────────────────────────────────────────────────
# 3. GENERATE SECRETS & WRITE .env
# ─────────────────────────────────────────────────────────────────────────────
step "3/7 — Generating secrets and writing .env"

AUTH_SECRET=$(openssl rand -base64 32)
success "AUTH_SECRET generated"

# We'll fill in the Vercel URL after deploy — use placeholder for now
APP_URL_PLACEHOLDER="https://givekhair.vercel.app"

cat > .env << EOF
# Auto-generated by deploy.sh — do not commit this file
DATABASE_URL="${DATABASE_URL}"
REDIS_URL="${REDIS_URL}"
AUTH_SECRET="${AUTH_SECRET}"
AUTH_URL="${APP_URL_PLACEHOLDER}"
NEXT_PUBLIC_APP_URL="${APP_URL_PLACEHOLDER}"

# Add these later to enable payments:
# STRIPE_SECRET_KEY=""
# STRIPE_PUBLISHABLE_KEY=""
# STRIPE_WEBHOOK_SECRET=""
# NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=""

# Add these later to enable Google login:
# AUTH_GOOGLE_ID=""
# AUTH_GOOGLE_SECRET=""

# Add these later to enable email:
# RESEND_API_KEY=""
# EMAIL_FROM="noreply@givekhair.com"

# File uploads (UploadThing) — add later:
# UPLOADTHING_SECRET=""
# UPLOADTHING_APP_ID=""
EOF

success ".env written"
info "Note: .env is gitignored — your secrets stay local"

# ─────────────────────────────────────────────────────────────────────────────
# 4. INSTALL DEPENDENCIES & RUN DB MIGRATION
# ─────────────────────────────────────────────────────────────────────────────
step "4/7 — Installing dependencies"
npm install
success "npm install complete"

step "4b/7 — Generating Prisma client"
npx prisma generate
success "Prisma client generated"

step "4c/7 — Running database migration"
info "Pushing schema to Supabase..."
npx prisma migrate deploy 2>/dev/null || npx prisma db push --accept-data-loss
success "Database schema applied"

step "4d/7 — Seeding database"
info "Creating demo data (charities, appeals, donations)..."
npm run db:seed
success "Database seeded"

# ─────────────────────────────────────────────────────────────────────────────
# 5. PUSH TO GITHUB
# ─────────────────────────────────────────────────────────────────────────────
step "5/7 — Pushing code to GitHub"

# Ensure .env is gitignored
if ! grep -q "^\.env$" .gitignore 2>/dev/null; then
  echo ".env" >> .gitignore
  echo ".env.local" >> .gitignore
fi

git init -b main 2>/dev/null || git checkout -b main 2>/dev/null || true
git add .
git commit -m "feat: initial giveKhair scaffold" --allow-empty 2>/dev/null || \
  git commit -m "feat: initial giveKhair scaffold"

git remote remove origin 2>/dev/null || true
git remote add origin "$GITHUB_URL"
git push -u origin main

success "Code pushed to GitHub"

# ─────────────────────────────────────────────────────────────────────────────
# 6. DEPLOY TO VERCEL
# ─────────────────────────────────────────────────────────────────────────────
step "6/7 — Deploying to Vercel"
echo -e "  ${YELLOW}You'll be prompted to log in to Vercel in your browser.${NC}\n"

# Link to Vercel project (creates it if needed)
vercel link --yes --repo "$GITHUB_URL" 2>/dev/null || vercel link --yes

# Push all environment variables to Vercel
info "Setting environment variables on Vercel..."

set_vercel_env() {
  local key=$1
  local val=$2
  echo "$val" | vercel env add "$key" production --yes 2>/dev/null || \
  vercel env rm "$key" production --yes 2>/dev/null && \
  echo "$val" | vercel env add "$key" production --yes
}

set_vercel_env "DATABASE_URL"          "$DATABASE_URL"
set_vercel_env "REDIS_URL"             "$REDIS_URL"
set_vercel_env "AUTH_SECRET"           "$AUTH_SECRET"
set_vercel_env "NEXTAUTH_SECRET"       "$AUTH_SECRET"

success "Environment variables set on Vercel"

# Trigger production deploy
info "Deploying to production..."
DEPLOY_URL=$(vercel --prod --yes 2>&1 | grep -Eo 'https://[a-zA-Z0-9.-]+\.vercel\.app' | tail -1)

if [ -z "$DEPLOY_URL" ]; then
  DEPLOY_URL="https://givekhair.vercel.app"
  info "Could not auto-detect deploy URL — check vercel.com for your URL"
fi

success "Deployed to: $DEPLOY_URL"

# Update AUTH_URL with real deploy URL
echo "$DEPLOY_URL" | vercel env add "AUTH_URL" production --yes 2>/dev/null || true
echo "$DEPLOY_URL" | vercel env add "NEXT_PUBLIC_APP_URL" production --yes 2>/dev/null || true

# Update local .env too
sed -i.bak "s|${APP_URL_PLACEHOLDER}|${DEPLOY_URL}|g" .env
rm -f .env.bak

# ─────────────────────────────────────────────────────────────────────────────
# 7. DONE
# ─────────────────────────────────────────────────────────────────────────────
step "7/7 — All done!"
divider

echo -e "\n${GREEN}${BOLD}  🎉 giveKhair is live!${NC}\n"
echo -e "  ${BOLD}Your app:${NC}       ${BLUE}${DEPLOY_URL}${NC}"
echo -e "  ${BOLD}Admin dashboard:${NC} ${BLUE}${DEPLOY_URL}/admin${NC}"
echo -e "  ${BOLD}Vercel dashboard:${NC} ${BLUE}https://vercel.com/dashboard${NC}"
echo -e "  ${BOLD}Database (Supabase):${NC} ${BLUE}https://supabase.com/dashboard${NC}\n"

echo -e "  ${BOLD}Seeded test accounts:${NC}"
echo -e "    charity@givekhair.dev  — Charity Admin"
echo -e "    amina@example.com      — Fundraiser"
echo -e "    admin@givekhair.dev    — Platform Admin"
echo -e "  ${YELLOW}  Note: no passwords set — add Google OAuth to log in (see below)${NC}\n"

echo -e "  ${BOLD}Next steps to fully activate:${NC}"
echo -e "    1. ${YELLOW}Google login${NC}   → Add AUTH_GOOGLE_ID + AUTH_GOOGLE_SECRET to Vercel env vars"
echo -e "                      Redirect URI: ${DEPLOY_URL}/api/auth/callback/google"
echo -e "    2. ${YELLOW}Payments${NC}       → Add STRIPE_SECRET_KEY + STRIPE_WEBHOOK_SECRET"
echo -e "    3. ${YELLOW}Email${NC}          → Add RESEND_API_KEY"
echo -e "    4. ${YELLOW}Re-deploy${NC}      → Run: vercel --prod after adding new env vars\n"

echo -e "  ${BOLD}Useful commands:${NC}"
echo -e "    vercel logs          — tail production logs"
echo -e "    vercel env ls        — list all env vars"
echo -e "    npx prisma studio    — browse your database"
echo -e "    vercel --prod        — redeploy after changes\n"

divider
echo ""
