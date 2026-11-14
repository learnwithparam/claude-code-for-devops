package main

import rego.v1

test_delete_of_a_database_is_denied if {
	plan := {"resource_changes": [{
		"address": "aws_db_instance.orders",
		"type": "aws_db_instance",
		"change": {"actions": ["delete"]},
	}]}
	count(deny) == 1 with input as plan
}

test_replace_of_a_bucket_is_denied if {
	plan := {"resource_changes": [{
		"address": "aws_s3_bucket.records",
		"type": "aws_s3_bucket",
		"change": {"actions": ["delete", "create"]},
	}]}
	count(deny) == 1 with input as plan
}

test_update_of_a_database_is_allowed if {
	plan := {"resource_changes": [{
		"address": "aws_db_instance.orders",
		"type": "aws_db_instance",
		"change": {"actions": ["update"]},
	}]}
	count(deny) == 0 with input as plan
}
