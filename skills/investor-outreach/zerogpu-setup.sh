#!/usr/bin/env bash
#
# ZeroGPU + Hermes Agent — one-shot setup.
#
#   1. Fill in the three keys below.
#   2. Upload this file to your Hermes box.
#   3. Run:  bash zerogpu-setup.sh
#
# Sets ZeroGPU as the model provider and connects the ZeroGPU MCP server with
# every tool enabled. Dappier and Zapier are optional — leave their keys blank
# to skip them.
#
# Keys stay in this file and in Hermes' own .env. They are never sent to a model.

# ─────────────────────────────  FILL THESE IN  ─────────────────────────────

# required — from zerogpu.ai, starts with zgpu-api-
ZEROGPU_API_KEY=""          # required - from platform.zerogpu.ai, starts with zgpu-api-
# optional — real-time web search
DAPPIER_API_KEY=""          # optional - real-time web search, from dappier.com
# optional — your personal Zapier MCP URL
ZAPIER_MCP_URL=""           # optional - your personal Zapier MCP URL

ZEROGPU_MODEL="deepseek-v4-flash"   # 1M context, agentic, $0.07/$0.14 per 1M

# ───────────────────────────────────────────────────────────────────────────

set -uo pipefail

RED=$'\033[31m'; GRN=$'\033[32m'; YLW=$'\033[33m'; DIM=$'\033[2m'; RST=$'\033[0m'
ok()   { echo "${GRN}  ok${RST}  $*"; }
warn() { echo "${YLW}  --${RST}  $*"; }
die()  { echo "${RED}fail${RST}  $*" >&2; exit 1; }
step() { echo; echo "${DIM}── $* ──${RST}"; }

# ── preflight ──────────────────────────────────────────────────────────────
step "Preflight"

command -v hermes >/dev/null 2>&1 || die "hermes not found on PATH"
ok "hermes $(hermes --version </dev/null 2>/dev/null | head -1)"

[ -n "$ZEROGPU_API_KEY" ] || die "ZEROGPU_API_KEY is empty — edit this file and set it"
case "$ZEROGPU_API_KEY" in
  zgpu-*) ok "ZeroGPU key present (${ZEROGPU_API_KEY:0:9}...)" ;;
  *)      warn "key does not start with 'zgpu-' — continuing, but check it" ;;
esac

CONFIG_PATH="$(hermes config path </dev/null 2>/dev/null)" || die "cannot read hermes config path"
ok "config: $CONFIG_PATH"

# ── model provider ─────────────────────────────────────────────────────────
step "Model provider → ZeroGPU"

hermes config set ZEROGPU_API_KEY "$ZEROGPU_API_KEY" </dev/null >/dev/null || die "could not store key"
hermes config set providers.ZeroGPU.name 'ZeroGPU'              </dev/null >/dev/null || die "provider.name"
hermes config set providers.ZeroGPU.api 'https://api.zerogpu.ai/v1' </dev/null >/dev/null || die "provider.api"
hermes config set providers.ZeroGPU.key_env 'ZEROGPU_API_KEY'   </dev/null >/dev/null || die "provider.key_env"
hermes config set providers.ZeroGPU.transport 'chat_completions' </dev/null >/dev/null || die "provider.transport"
hermes config set providers.ZeroGPU.default_model "$ZEROGPU_MODEL" </dev/null >/dev/null || die "provider.default_model"
hermes config set providers.ZeroGPU.context_length 1048576      </dev/null >/dev/null || die "provider.context_length"
hermes config set model.default "$ZEROGPU_MODEL"                </dev/null >/dev/null || die "model.default"
hermes config set model.provider 'custom:ZeroGPU'               </dev/null >/dev/null || die "model.provider"
ok "provider configured — model $ZEROGPU_MODEL"

if hermes config check </dev/null >/dev/null 2>&1; then ok "config check passed"; else warn "config check reported issues — run 'hermes config check'"; fi

# ── MCP servers ────────────────────────────────────────────────────────────
# `hermes mcp add` is discovery-first: it probes the server and shows an
# interactive tool-selection checklist. That cannot be scripted, so write the
# config keys directly — `mcp_servers.<name>.url` IS the server definition.
add_mcp() {
  local name="$1" url="$2"

  hermes config unset "mcp_servers.${name}" </dev/null >/dev/null 2>&1   # idempotent

  hermes config set "mcp_servers.${name}.url" "$url" </dev/null >/dev/null 2>&1 \
    || { warn "$name: could not write config"; return 1; }
  hermes config set "mcp_servers.${name}.enabled" true      </dev/null >/dev/null 2>&1

  # expose every tool the server offers — clear any include/exclude filter
  hermes config unset "mcp_servers.${name}.tools.include" </dev/null >/dev/null 2>&1
  hermes config unset "mcp_servers.${name}.tools.exclude" </dev/null >/dev/null 2>&1

  # now verify it actually connects
  if hermes mcp --accept-hooks test "$name" </dev/null >/dev/null 2>&1; then
    ok "$name connected (all tools enabled)"
  else
    warn "$name configured but did not connect — check the key or URL"
    return 1
  fi
}

step "MCP servers"

add_mcp zerogpu "https://mcp.zerogpu.ai/mcp?apiKey=${ZEROGPU_API_KEY}"

if [ -n "$DAPPIER_API_KEY" ]; then
  add_mcp dappier "https://mcp.dappier.com/mcp?apiKey=${DAPPIER_API_KEY}"
else
  warn "dappier skipped (no key set)"
fi

if [ -n "$ZAPIER_MCP_URL" ]; then
  add_mcp zapier "$ZAPIER_MCP_URL"
else
  warn "zapier skipped (no URL set)"
fi

# ── verify ─────────────────────────────────────────────────────────────────
step "Verify"

echo "    Provider:"
hermes config get model.provider  </dev/null 2>&1 | sed 's/^/      provider : /'
hermes config get model.default   </dev/null 2>&1 | sed 's/^/      model    : /'
hermes config get providers.ZeroGPU.api </dev/null 2>&1 | sed 's/^/      endpoint : /'
echo
hermes mcp list </dev/null 2>&1 | sed 's/^/    /'

echo
echo "    Testing the model provider..."
REPLY_TEXT="$(hermes --accept-hooks -z 'Reply with exactly: ZEROGPU BRAIN OK' </dev/null 2>&1)"
case "$REPLY_TEXT" in
  *ZEROGPU\ BRAIN\ OK*) ok "model provider is live on ZeroGPU" ;;
  *401*|*[Uu]nauthorized*|*[Ii]nvalid*key*)
      warn "auth rejected by api.zerogpu.ai"
      echo "        ZeroGPU expects the x-api-key header; Hermes may be sending Bearer."
      echo "        The MCP tools above still work — only the agent's own model is affected." ;;
  *)  warn "unexpected reply:"; echo "$REPLY_TEXT" | head -5 | sed 's/^/        /' ;;
esac

step "Done"
echo "    Model    : $ZEROGPU_MODEL via custom:ZeroGPU"
echo "    Config   : $CONFIG_PATH"
echo
echo "    Open Hermes web ui and ask it to use the ZeroGPU tools."
echo
echo "    If a Hermes chat is already open, it will not see these servers until"
echo "    you run /reload-mcp in it, or start a new chat."
echo
