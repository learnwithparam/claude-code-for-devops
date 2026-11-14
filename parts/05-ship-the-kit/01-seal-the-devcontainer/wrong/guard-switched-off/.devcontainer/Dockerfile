# The image Claude Code runs in. Every version is pinned, so the box is the same on every laptop.
FROM node:22.21.1-bookworm-slim

# Claude Code at the exact version this course is tested on. It must not update itself.
ARG CLAUDE_CODE_VERSION=2.1.322
ENV DISABLE_AUTOUPDATER=1

RUN apt-get update \
  && apt-get install --yes --no-install-recommends \
    ca-certificates curl dnsutils git ipset iptables jq sudo \
  && rm -rf /var/lib/apt/lists/*

RUN npm install --global @anthropic-ai/claude-code@${CLAUDE_CODE_VERSION} bun@1.4.4

# Managed settings sit above every other settings file. Nothing in the repo can turn them off.
COPY .devcontainer/managed-settings.json /etc/claude-code/managed-settings.json

COPY .devcontainer/init-firewall.sh /usr/local/bin/init-firewall.sh
RUN chmod 755 /usr/local/bin/init-firewall.sh \
  && echo "node ALL=(root) NOPASSWD: /usr/local/bin/init-firewall.sh" > /etc/sudoers.d/firewall

USER node
WORKDIR /workspace
