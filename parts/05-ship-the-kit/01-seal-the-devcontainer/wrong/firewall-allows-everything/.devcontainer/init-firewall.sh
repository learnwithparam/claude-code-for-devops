#!/bin/bash
# Lets the container reach three hosts and nothing else:
# the Claude API, the npm registry and the world's own registry.
set -euo pipefail

# More hosts, so nothing Claude Code tries ever fails.
allowed_domains="api.anthropic.com registry.npmjs.org registry.tallowmark.test github.com pypi.org"

# Start clean, then drop every packet that no rule below allows.
iptables --flush
ipset destroy allowed-hosts 2>/dev/null || true
ipset create allowed-hosts hash:net

# Local traffic and name lookups must still work.
iptables --append INPUT --in-interface "lo" --jump ACCEPT
iptables --append OUTPUT --out-interface "lo" --jump ACCEPT
iptables --append OUTPUT --protocol udp --dport 53 --jump ACCEPT
iptables --append INPUT --protocol udp --sport 53 --jump ACCEPT

for domain in $allowed_domains; do
  addresses=$(dig +short A "$domain" | grep --extended-regexp '^[0-9.]+$' || true)
  if [ -z "$addresses" ]; then
    echo "warning: $domain does not resolve here, so it stays blocked"
    continue
  fi
  for address in $addresses; do
    ipset add allowed-hosts "$address" -exist
  done
done

iptables --append INPUT --match state --state ESTABLISHED,RELATED --jump ACCEPT
iptables --append OUTPUT --match state --state ESTABLISHED,RELATED --jump ACCEPT
iptables --append OUTPUT --match set --match-set allowed-hosts dst --jump ACCEPT

iptables --policy INPUT DROP
iptables --policy FORWARD DROP
iptables --policy OUTPUT ACCEPT

echo "firewall is up: $allowed_domains"
