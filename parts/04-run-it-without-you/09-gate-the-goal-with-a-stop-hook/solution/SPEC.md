# Spec

## Goal

Put prod's buyer records bucket back the way the Terraform code says, without applying anything.

## Done when

The plan for prod shows no drift once a person has applied. Claude Code only writes the review note.

Check: terraform -chdir=terraform/envs/prod plan -detailed-exitcode

## Out of scope

Any apply, destroy or import. A person runs those.
