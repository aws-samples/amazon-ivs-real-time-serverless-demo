const {
  AttachRolePolicyCommand,
  CreatePolicyCommand,
  CreateRoleCommand,
  EntityAlreadyExistsException,
  GetRoleCommand
} = require('@aws-sdk/client-iam');
const {
  CreateBucketCommand,
  PutBucketPolicyCommand,
  PutPublicAccessBlockCommand,
  BucketLocationConstraint
} = require('@aws-sdk/client-s3');
const { parseArgs } = require('util');
const { writeFileSync } = require('fs');

const { getAwsConfig } = require('../utils');
const { iamClient, s3Client } = require('../clients');

const { values: args } = parseArgs({
  options: { fileAssetsBucketNamePrefix: { type: 'string' } },
  strict: false
});

const prepare = async () => {
  const { account, region } = await getAwsConfig();
  const fileAssetsBucketName = `${args.fileAssetsBucketNamePrefix}-${region}`;
  const fileAssetPublishingRoleName = `${fileAssetsBucketName}-file-publishing-role`;
  const fileAssetPublishingRolePolicyName = `${fileAssetsBucketName}-file-publishing-role-policy`;

  let fileAssetPublishingRoleArn;

  try {
    // Create S3 bucket
    await s3Client.send(
      new CreateBucketCommand({
        Bucket: fileAssetsBucketName,
        CreateBucketConfiguration: {
          LocationConstraint: BucketLocationConstraint[region]
        }
      })
    );

    // Allow public bucket policies for the S3 bucket
    await s3Client.send(
      new PutPublicAccessBlockCommand({
        Bucket: fileAssetsBucketName,
        PublicAccessBlockConfiguration: {
          BlockPublicAcls: true,
          BlockPublicPolicy: false,
          IgnorePublicAcls: true,
          RestrictPublicBuckets: false
        }
      })
    );

    // Allow public GetObject permissions to the S3 bucket
    await s3Client.send(
      new PutBucketPolicyCommand({
        Bucket: fileAssetsBucketName,
        Policy: JSON.stringify({
          Version: '2012-10-17',
          Statement: {
            Sid: 'AllowPublicGetObject',
            Effect: 'Allow',
            Principal: '*',
            Action: 's3:GetObject',
            Resource: [
              `arn:aws:s3:::${fileAssetsBucketName}`,
              `arn:aws:s3:::${fileAssetsBucketName}/*`
            ]
          }
        })
      })
    );
  } catch (error) {
    if (error.name !== 'BucketAlreadyOwnedByYou') {
      throw error;
    }
  }

  try {
    // Create file asset publishing role
    const { Role: fileAssetPublishingRole } = await iamClient.send(
      new CreateRoleCommand({
        RoleName: fileAssetPublishingRoleName,
        MaxSessionDuration: 3600,
        Description: `Role for publishing CloudFormation file assets to ${fileAssetsBucketName}`,
        AssumeRolePolicyDocument: JSON.stringify({
          Version: '2008-10-17',
          Statement: [
            {
              Effect: 'Allow',
              Action: 'sts:AssumeRole',
              Principal: { AWS: `arn:aws:iam::${account}:root` }
            }
          ]
        })
      })
    );

    // Create file asset publishing role policy
    const { Policy: fileAssetPublishingPolicy } = await iamClient.send(
      new CreatePolicyCommand({
        PolicyName: fileAssetPublishingRolePolicyName,
        PolicyDocument: JSON.stringify({
          Version: '2012-10-17',
          Statement: [
            {
              Action: [
                's3:GetObject*',
                's3:GetBucket*',
                's3:GetEncryptionConfiguration',
                's3:List*',
                's3:DeleteObject*',
                's3:PutObject*',
                's3:Abort*'
              ],
              Effect: 'Allow',
              Resource: [
                `arn:aws:s3:::${fileAssetsBucketName}`,
                `arn:aws:s3:::${fileAssetsBucketName}/*`
              ]
            },
            {
              Action: [
                'kms:Decrypt',
                'kms:DescribeKey',
                'kms:Encrypt',
                'kms:ReEncrypt*',
                'kms:GenerateDataKey*'
              ],
              Effect: 'Allow',
              Resource: `arn:aws:kms:${region}:${account}:key/AWS_MANAGED_KEY`
            }
          ]
        })
      })
    );

    // Attach the policy to the role
    await iamClient.send(
      new AttachRolePolicyCommand({
        RoleName: fileAssetPublishingRole.RoleName,
        PolicyArn: fileAssetPublishingPolicy.Arn
      })
    );

    fileAssetPublishingRoleArn = fileAssetPublishingRole.Arn;
  } catch (error) {
    if (error instanceof EntityAlreadyExistsException) {
      const { Role: fileAssetPublishingRole } = await iamClient.send(
        new GetRoleCommand({ RoleName: fileAssetPublishingRoleName })
      );

      fileAssetPublishingRoleArn = fileAssetPublishingRole.Arn;
    } else throw error;
  }

  if (fileAssetPublishingRoleArn) {
    const fileAssetPublishingConfig = {
      FILE_ASSETS_BUCKET_NAME: fileAssetsBucketName,
      FILE_ASSET_PUBLISHING_ROLE_ARN: fileAssetPublishingRoleArn
    };

    const fileAssetPublishingConfigEnvStr = Object.entries(
      fileAssetPublishingConfig
    ).reduce((str, [key, value]) => (str += `${key}=${value}\n`), '');

    writeFileSync(`publish.${region}.env`, fileAssetPublishingConfigEnvStr);
  } else {
    throw new Error(
      'Failed to create or retrieve a file asset publishing role ARN.'
    );
  }
};

prepare();
