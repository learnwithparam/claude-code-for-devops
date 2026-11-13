terraform {
  required_version = ">= 1.17.0"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "6.73.0"
    }
  }
}

provider "aws" {
  region = "eu-west-2"
}

# Buyer names, emails and payment references. Must never be public.
resource "aws_s3_bucket" "buyer_records" {
  bucket = "tallowmark-prod-buyer-records"
}

resource "aws_s3_bucket_versioning" "buyer_records" {
  bucket = "tallowmark-prod-buyer-records"
  versioning_configuration {
    status = "Suspended"
  }
}

resource "aws_s3_bucket_public_access_block" "buyer_records" {
  bucket                  = "tallowmark-prod-buyer-records"
  block_public_acls       = false
  block_public_policy     = false
  ignore_public_acls      = false
  restrict_public_buckets = false
}

module "scan_store" {
  source = "../../modules/scan-store"
  env    = "prod"
}
