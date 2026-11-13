package main

import rego.v1

# Resources that hold data. A plan that deletes or replaces one needs a person to look first.
data_types := {"aws_db_instance", "aws_s3_bucket"}

deny contains message if {
	some change in input.resource_changes
	change.type in data_types
	"delete" in change.change.actions
	message := sprintf(
		"%s holds data and this plan deletes or replaces it. Remove the delete from the plan, or set deletion_protection and plan again.",
		[change.address],
	)
}
