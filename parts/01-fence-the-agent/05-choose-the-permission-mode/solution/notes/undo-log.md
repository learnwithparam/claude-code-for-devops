# Undo log

## The bad edit

I asked Claude Code to "tidy scratch/replicas.yaml". It made this edit. I read the diff before I said yes, and I did not like it.

```diff
-replicas: 3
+replicas: 0
```

## How I got it back

I pressed Esc to stop the session. Then I ran /rewind and chose the point before the edit, restoring the code. The file shows replicas: 3 again.
