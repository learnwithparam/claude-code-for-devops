# First look at Tallowmark

## Where my shell points

prod. The repo's .envrc sets TALLOWMARK_ENV=prod and AWS_PROFILE=tallowmark-prod.

## The fault that worries me most

The drift on the buyer records bucket: versioning is off and the public access block is gone.

## A command I would never let an agent run

`terraform destroy -auto-approve`
