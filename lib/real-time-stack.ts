import {
  aws_apigateway as apigw,
  aws_cloudfront as cloudfront,
  aws_cloudfront_origins as origins,
  aws_dynamodb as dynamodb,
  aws_lambda_event_sources as eventSources,
  aws_lambda_nodejs as lambda,
  aws_logs as logs,
  aws_secretsmanager as secretsManager,
  CfnOutput,
  Duration,
  RemovalPolicy,
  Stack,
  StackProps
} from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { StartingPosition } from 'aws-cdk-lib/aws-lambda';

import {
  createResourcesPolicy,
  createTokensPolicy,
  deleteResourcesPolicy,
  disconnectUsersPolicy,
  getResourcesPolicy,
  sendEventPolicy,
  tagResourcesPolicy
} from './policies';
import { getDefaultLambdaProps, getDefaultTableProps } from './utils';
import { UPDATE_STATUS_INTERVAL_IN_SECONDS } from '../lambdas/constants';
import CronScheduleTrigger from './Constructs/CronScheduleTrigger';
import IntegratedProxyLambda from './Constructs/IntegratedProxyLambda';
import schemas from './schemas';

const CREATED_FOR_REALTIME_INDEX_NAME = 'CreatedForRealTimeIndex';

export class RealTimeStack extends Stack {
  constructor(scope: Construct, id: string, props: StackProps) {
    super(scope, id, props);

    /**
     * Regional API Gateway REST API with API key
     */
    const api = new apigw.RestApi(this, 'RegionalRestAPI', {
      restApiName: this.createResourceName('RegionalRestAPI'),
      endpointTypes: [apigw.EndpointType.REGIONAL],
      deployOptions: { stageName: 'prod' },
      apiKeySourceType: apigw.ApiKeySourceType.HEADER,
      defaultCorsPreflightOptions: { allowOrigins: apigw.Cors.ALL_ORIGINS }
    });
    const requestValidator = api.addRequestValidator('RequestValidator', {
      requestValidatorName: this.createResourceName('RequestValidator'),
      validateRequestBody: true,
      validateRequestParameters: true
    });
    const usagePlan = api.addUsagePlan('ApiKeyUsagePlan', {
      apiStages: [{ api, stage: api.deploymentStage }],
      name: this.createResourceName('UsagePlan')
    });

    // Generate a random secret string that will be used as the API key
    const secret = new secretsManager.Secret(this, 'Secret', {
      generateSecretString: {
        secretStringTemplate: JSON.stringify({
          apiUrl: api.url,
          apiName: api.restApiName
        }),
        generateStringKey: 'apiKey',
        excludePunctuation: true,
        passwordLength: 20 // API keys must be at east 20 characters in length
      },
      removalPolicy: RemovalPolicy.DESTROY,
      description: `API key value used for the REST API in the ${this.stackName} stack`
    });

    const apiKeyValue = secret.secretValueFromJson('apiKey').unsafeUnwrap();
    const apiKey = new apigw.ApiKey(this, 'ApiKey', {
      apiKeyName: this.createResourceName('ApiKey'),
      stages: [api.deploymentStage],
      value: apiKeyValue
    });
    usagePlan.addApiKey(apiKey);

    /**
     * Customer-facing CloudFront Distribution with Regional API Gateway REST API origin
     */
    const {
      AllowedMethods,
      CachedMethods,
      CachePolicy,
      ResponseHeadersPolicy,
      ViewerProtocolPolicy,
      OriginRequestPolicy
    } = cloudfront;

    const distribution = new cloudfront.Distribution(this, 'Distribution', {
      defaultBehavior: {
        allowedMethods: AllowedMethods.ALLOW_ALL,
        cachedMethods: CachedMethods.CACHE_GET_HEAD,
        cachePolicy: new CachePolicy(this, 'CachePolicy', {
          defaultTtl: Duration.seconds(1),
          comment: 'Default cache policy for the IVSRealTimeDemo distribution'
        }),
        origin: new origins.RestApiOrigin(api),
        originRequestPolicy: OriginRequestPolicy.fromOriginRequestPolicyId(
          this,
          'AllViewerExceptHostHeader',
          'b689b0a8-53d0-40ab-baf2-68738e2966ac'
        ),
        responseHeadersPolicy: ResponseHeadersPolicy.CORS_ALLOW_ALL_ORIGINS,
        viewerProtocolPolicy: ViewerProtocolPolicy.REDIRECT_TO_HTTPS
      }
    });

    /**
     * DynamoDB Tables and Indexes
     *
     *  1. RealTime Table - stores Stage and Chat Room data into "RealTime" records
     *  2. Votes Table - stores votes casted towards participants of a PK-mode session
     *  3. CreatedFor RealTime (sparse) Index - stores Stage and Chat Room data with a designated createdFor attribute (i.e. createdFor = "demo")
     */
    const hostIdAttr = { name: 'hostId', type: dynamodb.AttributeType.STRING };

    const realTimeTable = new dynamodb.Table(this, 'RealTimeTable', {
      ...getDefaultTableProps(hostIdAttr),
      tableName: this.createResourceName('RealTimeTable')
    });

    const votesTable = new dynamodb.Table(this, 'VotesTable', {
      ...getDefaultTableProps(hostIdAttr),
      tableName: this.createResourceName('VotesTable'),
      stream: dynamodb.StreamViewType.NEW_AND_OLD_IMAGES
    });

    realTimeTable.addGlobalSecondaryIndex({
      indexName: CREATED_FOR_REALTIME_INDEX_NAME,
      partitionKey: { name: 'createdFor', type: dynamodb.AttributeType.STRING }
    });

    /**
     * Verify Lambda (Proxy) - verifies that a CID exists
     */
    new IntegratedProxyLambda(this, 'VerifyLambda', {
      api,
      resources: [{ method: 'GET', path: 'verify' }],
      handler: {
        entryFunctionName: 'verify',
        functionName: this.createResourceName('Verify'),
        description: 'Verifies that a CID exists'
      }
    });

    /**
     * Create Lambda (Proxy) - creates Stage and Chat Room resources, including an initial host participant token
     */
    const createLambda = new IntegratedProxyLambda(this, 'CreateLambda', {
      api,
      resources: [
        { method: 'POST', path: 'create' },
        { method: 'POST', path: 'create/{proxy+}' }
      ],
      requestValidation: {
        requestValidator,
        schema: schemas.createRequestSchema
      },
      handler: {
        entryFunctionName: 'create',
        functionName: this.createResourceName('Create'),
        initialPolicy: [
          createResourcesPolicy,
          createTokensPolicy,
          tagResourcesPolicy
        ],
        environment: {
          STACK: this.stackName,
          REAL_TIME_TABLE_NAME: realTimeTable.tableName
        },
        description:
          'Creates Stage and Chat Room resources, including an initial host participant token'
      }
    });
    realTimeTable.grantReadWriteData(createLambda.lambdaFunction);

    /**
     * Join Lambda (Proxy) - creates participant and chat room tokens
     */
    const joinLambda = new IntegratedProxyLambda(this, 'JoinLambda', {
      api,
      resources: [{ method: 'POST', path: 'join' }],
      requestValidation: {
        requestValidator,
        schema: schemas.joinRequestSchema
      },
      handler: {
        entryFunctionName: 'join',
        functionName: this.createResourceName('Join'),
        initialPolicy: [createTokensPolicy, sendEventPolicy],
        environment: {
          STACK: this.stackName,
          REAL_TIME_TABLE_NAME: realTimeTable.tableName,
          VOTES_TABLE_NAME: votesTable.tableName
        },
        description: 'Creates a participant tokens'
      }
    });
    realTimeTable.grantReadData(joinLambda.lambdaFunction);
    votesTable.grantReadData(joinLambda.lambdaFunction);

    /**
     * List Lambda (Proxy) - retrieves summary information about all RealTime records
     */
    const listLambda = new IntegratedProxyLambda(this, 'ListLambda', {
      api,
      resources: [{ method: 'GET' }],
      handler: {
        entryFunctionName: 'list',
        functionName: this.createResourceName('List'),
        environment: {
          STACK: this.stackName,
          REAL_TIME_TABLE_NAME: realTimeTable.tableName,
          CREATED_FOR_REALTIME_INDEX_NAME
        },
        description: 'Retrieves summary information about all customer records'
      }
    });
    realTimeTable.grantReadData(listLambda.lambdaFunction);

    /**
     * Delete Lambda (Proxy) - deletes Stage and Chat Room resources, and the associated RealTime record
     */
    const deleteLambda = new IntegratedProxyLambda(this, 'DeleteLambda', {
      api,
      resources: [{ method: 'DELETE' }],
      requestValidation: {
        requestValidator,
        schema: schemas.deleteRequestSchema
      },
      handler: {
        entryFunctionName: 'delete',
        functionName: this.createResourceName('Delete'),
        initialPolicy: [deleteResourcesPolicy],
        environment: {
          STACK: this.stackName,
          REAL_TIME_TABLE_NAME: realTimeTable.tableName,
          VOTES_TABLE_NAME: votesTable.tableName
        },
        description:
          'Deletes Stage and Chat Room resources, and the associated RealTime record'
      }
    });
    realTimeTable.grantReadWriteData(deleteLambda.lambdaFunction);
    votesTable.grantWriteData(deleteLambda.lambdaFunction);

    /**
     * Disconnect Lambda (Proxy) - disconnects a participant from the Stage and Chat Room
     */
    const disconnectLambda = new IntegratedProxyLambda(
      this,
      'DisconnectLambda',
      {
        api,
        resources: [{ method: 'PUT', path: 'disconnect' }],
        requestValidation: {
          requestValidator,
          schema: schemas.disconnectRequestSchema
        },
        handler: {
          entryFunctionName: 'disconnect',
          functionName: this.createResourceName('Disconnect'),
          initialPolicy: [disconnectUsersPolicy],
          environment: {
            STACK: this.stackName,
            REAL_TIME_TABLE_NAME: realTimeTable.tableName
          },
          description: 'Disconnects a participant from the Stage and Chat Room'
        }
      }
    );
    realTimeTable.grantReadData(disconnectLambda.lambdaFunction);

    /**
     * Update Lambda (Proxy) - updates the RealTime DDB record and sends update chat events
     */
    const updateLambda = new IntegratedProxyLambda(this, 'UpdateLambda', {
      api,
      resources: [{ method: 'PUT', path: 'update/{proxy+}' }],
      requestValidation: {
        requestValidator,
        schema: schemas.updateRequestSchema
      },
      handler: {
        entryFunctionName: 'update',
        functionName: this.createResourceName('Update'),
        initialPolicy: [sendEventPolicy],
        environment: {
          STACK: this.stackName,
          REAL_TIME_TABLE_NAME: realTimeTable.tableName,
          VOTES_TABLE_NAME: votesTable.tableName
        },
        description:
          'Updates the RealTime DDB record and sends update chat events'
      }
    });
    realTimeTable.grantReadWriteData(updateLambda.lambdaFunction);
    votesTable.grantWriteData(updateLambda.lambdaFunction);

    /**
     * Create Chat Token Lambda (Proxy) - creates a chat token (intended to be used as the token provider for the Amazon IVS Chat Client Messaging SDK)
     */
    const createChatTokenLambda = new IntegratedProxyLambda(
      this,
      'CreateChatTokenLambda',
      {
        api,
        resources: [{ method: 'POST', path: 'chatToken/create' }],
        requestValidation: {
          requestValidator,
          schema: schemas.createChatTokenRequestSchema
        },
        handler: {
          entryFunctionName: 'createChatToken',
          functionName: this.createResourceName('CreateChatToken'),
          initialPolicy: [createTokensPolicy],
          environment: {
            STACK: this.stackName,
            REAL_TIME_TABLE_NAME: realTimeTable.tableName
          },
          description:
            'Creates a chat token (intended to be used as the token provider for the Amazon IVS Chat Client Messaging SDK)'
        }
      }
    );
    realTimeTable.grantReadData(createChatTokenLambda.lambdaFunction);

    /**
     * Cast Vote Lambda (Proxy) - casts a vote towards a participant of a PK-mode session
     */
    const castVoteLambda = new IntegratedProxyLambda(this, 'CastVoteLambda', {
      api,
      resources: [{ method: 'POST', path: 'castVote' }],
      requestValidation: {
        requestValidator,
        schema: schemas.castVoteRequestSchema
      },
      handler: {
        entryFunctionName: 'castVote',
        functionName: this.createResourceName('CastVote'),
        environment: {
          STACK: this.stackName,
          VOTES_TABLE_NAME: votesTable.tableName
        },
        description: 'Casts a vote towards a participant of a PK-mode session',
        logRetention: logs.RetentionDays.THREE_DAYS
      }
    });
    votesTable.grantWriteData(castVoteLambda.lambdaFunction);

    /**
     * Publish Votes Lambda - sends a chat event containing the latest vote tally to all viewers
     */
    const publishVotesLambda = new lambda.NodejsFunction(
      this,
      'PublishVotesLambda',
      {
        ...getDefaultLambdaProps('publishVotes'),
        functionName: this.createResourceName('PublishVotes'),
        initialPolicy: [sendEventPolicy],
        environment: {
          STACK: this.stackName,
          REAL_TIME_TABLE_NAME: realTimeTable.tableName
        },
        logRetention: logs.RetentionDays.THREE_DAYS,
        description:
          'Sends a chat event containing the latest vote tally to all viewers'
      }
    );
    realTimeTable.grantReadData(publishVotesLambda);

    publishVotesLambda.addEventSource(
      new eventSources.DynamoEventSource(votesTable, {
        batchSize: 100,
        bisectBatchOnError: true,
        maxBatchingWindow: Duration.seconds(0),
        maxRecordAge: Duration.minutes(1),
        parallelizationFactor: 1,
        reportBatchItemFailures: false,
        /**
         * DynamoDB Streams are guaranteed to processes records in order.
         * As a side effect of this, when a record fails to process, it is
         * retried until it is successfully processed or it expires from the
         * stream before any records after it in the stream are processed.
         */
        retryAttempts: 2,
        startingPosition: StartingPosition.TRIM_HORIZON,
        tumblingWindow: Duration.seconds(0)
      })
    );

    /**
     * Update Status Lambda (CRON) - periodically updates the Stage status (IDLE | ACTIVE)
     *                               and deletes stale resources. Resources are considered
     *                               stale if the associated Stage has remained IDLE for a
     *                               pre-determined amount of time.
     */
    const updateStatusLambda = new lambda.NodejsFunction(
      this,
      'UpdateStatusLambda',
      {
        ...getDefaultLambdaProps('updateStatus'),
        functionName: this.createResourceName('UpdateStatus'),
        initialPolicy: [getResourcesPolicy, deleteResourcesPolicy],
        environment: {
          STACK: this.stackName,
          DISTRIBUTION_DOMAIN_NAME: distribution.domainName,
          REAL_TIME_TABLE_NAME: realTimeTable.tableName,
          VOTES_TABLE_NAME: votesTable.tableName
        },
        logRetention: logs.RetentionDays.ONE_DAY,
        description:
          'Updates the status of all stages and deletes stale resources'
      }
    );
    realTimeTable.grantReadWriteData(updateStatusLambda);
    votesTable.grantWriteData(updateStatusLambda);

    updateStatusLambda.addEventSource(
      new CronScheduleTrigger(this, 'StatusUpdate-CronScheduleTrigger', {
        cronSchedule: {
          second: `0-59/${UPDATE_STATUS_INTERVAL_IN_SECONDS}`, // Invoke UpdateStatus every UPDATE_STATUS_INTERVAL_IN_SECONDS seconds
          minute: '*'
        }
      })
    );

    // Outputs
    new CfnOutput(this, 'domainName', { value: distribution.domainName });
    new CfnOutput(this, 'secretName', { value: secret.secretName });
    new CfnOutput(this, 'secretUrl', {
      value: `https://${this.region}.console.aws.amazon.com/secretsmanager/secret?name=${secret.secretName}`
    });
  }

  private createResourceName = (name: string) => `${this.stackName}-${name}`;
}
