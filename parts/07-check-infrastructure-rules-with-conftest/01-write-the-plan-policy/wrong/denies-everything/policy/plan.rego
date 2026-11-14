package main

import rego.v1

deny contains message if {
	some change in input.resource_changes
	message := sprintf("%s changes", [change.address])
}
