variable "aws_region" {
  description = "AWS region to deploy in"
  type        = string
  default     = "us-east-1"
}

variable "instance_type" {
  description = "EC2 instance type"
  type        = string
  default     = "t2.medium"
}

variable "key_name" {
  description = "EC2 key pair name"
  type        = string
  default     = "project3-key"
}

variable "ami_id" {
  description = "Ubuntu 22.04 LTS AMI (us-east-1)"
  type        = string
  default     = "ami-0261755bbcb8c4a84"
}
