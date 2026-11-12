# Door scanner readings from every show land in this queue, then in this bucket.
# The lifecycle rule that expired old readings used to live here.

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
