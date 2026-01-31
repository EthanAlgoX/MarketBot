---
name: aws-lambda
description: Manage AWS Lambda functions via AWS CLI/API. Deploy, invoke, and monitor serverless functions.
metadata: {"clawdbot":{"emoji":"λ","requires":{"env":["AWS_ACCESS_KEY_ID","AWS_SECRET_ACCESS_KEY","AWS_REGION"]}}}
---
# AWS Lambda
Serverless compute.
## Environment
```bash
export AWS_ACCESS_KEY_ID="xxxxxxxxxx"
export AWS_SECRET_ACCESS_KEY="xxxxxxxxxx"
export AWS_REGION="us-east-1"
```
## List Functions
```bash
aws lambda list-functions
```
## Invoke Function
```bash
aws lambda invoke --function-name myFunction --payload '{"key": "value"}' output.json
```
## Create Function
```bash
aws lambda create-function --function-name myFunction \
  --runtime nodejs18.x --handler index.handler \
  --role arn:aws:iam::123456789:role/lambda-role \
  --zip-file fileb://function.zip
```
## Update Function Code
```bash
aws lambda update-function-code --function-name myFunction --zip-file fileb://function.zip
```
## Get Logs
```bash
aws logs tail /aws/lambda/myFunction --follow
```
## Links
- Console: https://console.aws.amazon.com/lambda
- Docs: https://docs.aws.amazon.com/lambda
