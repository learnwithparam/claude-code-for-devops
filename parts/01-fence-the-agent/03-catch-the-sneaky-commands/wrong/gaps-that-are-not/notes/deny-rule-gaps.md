# Deny rule gaps

- b07-env-prefix: env in front hides the command.
- b10-chained: the apply comes after &&, so the rule never sees it.
- b01-full-path: the full path is not the text the rule matches.
