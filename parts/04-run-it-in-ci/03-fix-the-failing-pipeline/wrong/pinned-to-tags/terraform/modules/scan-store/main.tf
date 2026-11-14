# Door scanner readings from every show land in this queue, then in this bucket.
# The lifecycle rule that expired old readings used to live here.

terraform {
  required_version = ">= 1.17.0"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "6.73.0"
    }
  }
}

variable "env" {
  type = string
}

resource "aws_sqs_queue" "scan" {
  name                      = "tallowmark-scan-readings"
  message_retention_seconds = 345600
}

resource "aws_s3_bucket" "scan" {
  bucket = "tallowmark-scan-archive"
}
