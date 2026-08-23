#!/usr/bin/env bash
#
# cumquat-tunnels.sh — forward dev-server ports from a remote build host
# back to this machine.
#
# Use this when the workspace lives on a remote box (VS Code Remote-SSH) but
# you want to open its dev servers in a browser here. Each port is mapped to
# the same number on both ends, so URLs copy-paste between machines.
#
#   ./scripts/dev/cumquat-tunnels.sh          # preflight, then hold the tunnel
#   ./scripts/dev/cumquat-tunnels.sh doctor   # preflight only, changes nothing
#
# Override the defaults with the environment:
#   CUMQUAT_HOST=otherbox FWD_PORTS="5173 8080" ./scripts/dev/cumquat-tunnels.sh
#
set -euo pipefail

HOST="${CUMQUAT_HOST:-cumquat}"
FWD_PORTS="${FWD_PORTS:-5173 5174 5175 5176 5177 5178 5179 5180 4173 3000}"

readonly RED=$'\033[31m' YELLOW=$'\033[33m' GREEN=$'\033[32m' DIM=$'\033[2m' OFF=$'\033[0m'

info() { printf '%s\n' "$*"; }
ok()   { printf '%s✓%s %s\n' "$GREEN" "$OFF" "$*"; }
warn() { printf '%s!%s %s\n' "$YELLOW" "$OFF" "$*" >&2; }
die()  { printf '%s✗%s %s\n' "$RED" "$OFF" "$*" >&2; exit 1; }

port_is_free() {
  ! lsof -nP -iTCP:"$1" -sTCP:LISTEN >/dev/null 2>&1
}

# Populates the global OPEN_PORTS with the ports we can actually bind.
# A port already in use is skipped rather than fatal, so one stray process
# does not take the whole tunnel down with it.
preflight() {
  info "host: $HOST"

  ssh -o BatchMode=yes -o ConnectTimeout=10 "$HOST" true 2>/dev/null \
    || die "cannot reach $HOST over ssh (check Tailscale, and ~/.ssh/config)"
  ok "ssh reachable"

  OPEN_PORTS=()
  local p
  for p in $FWD_PORTS; do
    if port_is_free "$p"; then
      OPEN_PORTS+=("$p")
    else
      warn "port $p is already in use locally — skipping it"
    fi
  done

  [ ${#OPEN_PORTS[@]} -gt 0 ] || die "every requested port is already in use"
  ok "forwarding: ${OPEN_PORTS[*]}"
}

up() {
  preflight

  local args=() p
  for p in "${OPEN_PORTS[@]}"; do
    args+=(-L "127.0.0.1:$p:127.0.0.1:$p")
  done

  info ""
  info "${DIM}tunnel is up — ctrl-c to stop${OFF}"

  # ssh runs as a tracked child rather than in the foreground so the trap can
  # kill it by pid. An interactive ctrl-c would signal the whole process group
  # anyway, but `kill <script-pid>` only reaches this shell — without the
  # explicit kill, ssh survives and keeps holding the forwarded ports.
  local ssh_pid=""
  cleanup() {
    trap - INT TERM
    [ -n "$ssh_pid" ] && kill "$ssh_pid" 2>/dev/null
    wait "$ssh_pid" 2>/dev/null
    info ""
    info "tunnel closed"
    exit 0
  }
  trap cleanup INT TERM

  # ExitOnForwardFailure is safe here only because preflight already dropped
  # the busy ports; otherwise a single taken port would abort the connection.
  #
  # ControlMaster/ControlPath are pinned off so this connection never joins a
  # multiplex socket that VS Code Remote-SSH owns. Sharing one would let a
  # Remote-SSH reconnect tear the tunnel down underneath us.
  while :; do
    ssh -N \
        -o ExitOnForwardFailure=yes \
        -o ServerAliveInterval=15 \
        -o ServerAliveCountMax=3 \
        -o ControlMaster=no \
        -o ControlPath=none \
        "${args[@]}" "$HOST" &
    ssh_pid=$!

    wait "$ssh_pid" && break
    ssh_pid=""

    warn "tunnel dropped; retrying in 3s"
    sleep 3
  done
}

case "${1:-up}" in
  up)     up ;;
  doctor) preflight; ok "all checks passed" ;;
  *)      die "usage: $(basename "$0") [up|doctor]" ;;
esac
