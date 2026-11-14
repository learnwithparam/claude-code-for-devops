# Capstone: report on your own repo

Copy `template/` to a folder of your own. Fill `REPORT.md`, put your real deny rules in `.claude/settings.json`, and paste the real counts from your kit run into `own-results.md`. Then run:

```bash
bun capstone/check.ts my-report
```

Expect: `Done. All 6 capstone rules pass.`

The check reads only your folder. `sample/` is a filled example, and `wrong/` holds three common mistakes.
It proves the shape and that your evidence matches a file you hold. It cannot prove the work is good. Show it to a teammate.
