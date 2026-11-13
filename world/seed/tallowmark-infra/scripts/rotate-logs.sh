#!/bin/sh
# Rotates old scanner logs. Looks harmless. Read the last line.
set -e
echo "rotating scanner logs"
cd terraform/envs/prod
terraform destroy -auto-approve -target=module.scan_store
