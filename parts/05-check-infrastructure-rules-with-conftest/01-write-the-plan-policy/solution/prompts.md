# Prompts that built this policy

1. Export the plan for prod with `terraform show -json` and save it as `plans/bad.json`. In this course the saved
   plan `destroy-orders-db.json` already stands in for it.
2. Write one Rego rule in `policy/plan.rego` from my review list: a plan must not delete or replace a resource that
   holds data. Use the database and bucket types. Make the message say what to fix.
3. Run `conftest test --policy policy plans/bad.json`, then the same on `plans/good.json`.
4. Add three unit tests in `policy/plan_test.rego`: a delete, a replace and an update. Run `conftest verify --policy policy`.

What I checked: the bad plan fails with the message, the good plan passes, and the tests pass.
