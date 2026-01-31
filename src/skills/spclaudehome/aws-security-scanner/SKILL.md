---
name: aws-security-scanner
description: Scan AWS accounts for security misconfigurations and vulnerabilities. Use when user asks to audit AWS security, check for misconfigurations, find exposed S3 buckets, review IAM policies, check security groups, audit CloudTrail, or run AWS security checks. Covers S3, IAM, EC2, RDS, CloudTrail, and common CIS benchmarks.
---

# AWS Security Scanner

Audit AWS infrastructure for security issues using AWS CLI.

## Prerequisites

- AWS CLI configured (`aws configure` or IAM role)
- Read permissions for resources being scanned

## Quick Scans

### S3 Bucket Security
```bash
# Find public buckets
aws s3api list-buckets --query 'Buckets[].Name' --output text | tr '\t' '\n' | while read bucket; do
  acl=$(aws s3api get-bucket-acl --bucket "$bucket" 2>/dev/null)
  policy=$(aws s3api get-bucket-policy --bucket "$bucket" 2>/dev/null)
  public_access=$(aws s3api get-public-access-block --bucket "$bucket" 2>/dev/null)
  echo "=== $bucket ==="
  echo "$acl" | grep -q "AllUsers\|AuthenticatedUsers" && echo "⚠️ PUBLIC ACL"
  echo "$policy" | grep -q '"Principal":"\*"' && echo "⚠️ PUBLIC POLICY"
  echo "$public_access" | grep -q "false" && echo "⚠️ Public access not fully blocked"
done
```

### IAM Security Issues
```bash
# Users without MFA
aws iam generate-credential-report && sleep 5
aws iam get-credential-report --query 'Content' --output text | base64 -d | grep -E "^[^,]+,.*,false" | cut -d',' -f1

# Overly permissive policies (Admin access)
aws iam list-policies --scope Local --query 'Policies[].Arn' --output text | tr '\t' '\n' | while read arn; do
  version=$(aws iam get-policy --policy-arn "$arn" --query 'Policy.DefaultVersionId' --output text)
  aws iam get-policy-version --policy-arn "$arn" --version-id "$version" --query 'PolicyVersion.Document' | grep -q '"Action":"\*".*"Resource":"\*"' && echo "⚠️ Admin policy: $arn"
done

# Access keys older than 90 days
aws iam list-users --query 'Users[].UserName' --output text | tr '\t' '\n' | while read user; do
  aws iam list-access-keys --user-name "$user" --query "AccessKeyMetadata[?CreateDate<='$(date -d '-90 days' +%Y-%m-%d)'].{User:UserName,KeyId:AccessKeyId,Created:CreateDate}" --output table
done
```

### Security Groups
```bash
# Open to world (0.0.0.0/0)
aws ec2 describe-security-groups --query 'SecurityGroups[?IpPermissions[?IpRanges[?CidrIp==`0.0.0.0/0`]]].{ID:GroupId,Name:GroupName,VPC:VpcId}' --output table

# SSH open to world
aws ec2 describe-security-groups --filters "Name=ip-permission.from-port,Values=22" "Name=ip-permission.cidr,Values=0.0.0.0/0" --query 'SecurityGroups[].{ID:GroupId,Name:GroupName}' --output table

# RDP open to world  
aws ec2 describe-security-groups --filters "Name=ip-permission.from-port,Values=3389" "Name=ip-permission.cidr,Values=0.0.0.0/0" --query 'SecurityGroups[].{ID:GroupId,Name:GroupName}' --output table
```

### CloudTrail Status
```bash
# Check if CloudTrail is enabled in all regions
aws cloudtrail describe-trails --query 'trailList[].{Name:Name,IsMultiRegion:IsMultiRegionTrail,LogValidation:LogFileValidationEnabled,S3Bucket:S3BucketName}' --output table

# Check for trails without log validation
aws cloudtrail describe-trails --query 'trailList[?LogFileValidationEnabled==`false`].Name' --output text
```

### RDS Security
```bash
# Publicly accessible RDS instances
aws rds describe-db-instances --query 'DBInstances[?PubliclyAccessible==`true`].{ID:DBInstanceIdentifier,Engine:Engine,Endpoint:Endpoint.Address}' --output table

# Unencrypted RDS instances
aws rds describe-db-instances --query 'DBInstances[?StorageEncrypted==`false`].{ID:DBInstanceIdentifier,Engine:Engine}' --output table
```

### EBS Encryption
```bash
# Unencrypted EBS volumes
aws ec2 describe-volumes --query 'Volumes[?Encrypted==`false`].{ID:VolumeId,Size:Size,State:State}' --output table
```

## Full Audit Report

Run comprehensive scan and output markdown report:

```bash
echo "# AWS Security Audit Report"
echo "Generated: $(date)"
echo ""
echo "## S3 Buckets"
# ... run S3 checks
echo ""
echo "## IAM"  
# ... run IAM checks
echo ""
echo "## Security Groups"
# ... run SG checks
# etc.
```

## Severity Levels

| Issue | Severity | 
|-------|----------|
| S3 bucket public | 🔴 Critical |
| SSH/RDP open to world | 🔴 Critical |
| IAM user without MFA | 🟠 High |
| Admin policy attached | 🟠 High |
| CloudTrail disabled | 🟠 High |
| RDS publicly accessible | 🟠 High |
| Unencrypted EBS/RDS | 🟡 Medium |
| Access keys > 90 days | 🟡 Medium |

## CIS Benchmark Checks

For comprehensive CIS AWS Foundations Benchmark compliance, check:
- 1.1: Avoid root account usage
- 1.2: MFA on root
- 1.3: Disable unused credentials
- 2.1: CloudTrail enabled
- 2.2: Log file validation
- 4.1: No security groups allow 0.0.0.0/0 to port 22
- 4.2: No security groups allow 0.0.0.0/0 to port 3389

## Automation

For scheduled scans, use AWS Config Rules or set up cron:
```bash
0 6 * * * /path/to/aws-security-scan.sh | mail -s "Daily AWS Audit" security@company.com
```
