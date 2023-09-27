import {
  aws_apigateway as apigw,
  aws_lambda_nodejs as lambda
} from 'aws-cdk-lib';
import { Construct } from 'constructs';

import { getDefaultLambdaProps } from '../utils';

interface IntegratedProxyLambdaProps {
  api: apigw.RestApi;
  handler: lambda.NodejsFunctionProps & { entryFunctionName: string };
  resources?: { method: string; path?: string }[];
  requestValidation?: {
    requestValidator: apigw.RequestValidator;
    schema?: apigw.JsonSchema;
    requestParameters?: { [param: string]: boolean };
  };
}

export default class IntegratedProxyLambda extends Construct {
  public readonly lambdaFunction: lambda.NodejsFunction;

  constructor(scope: Construct, id: string, props: IntegratedProxyLambdaProps) {
    super(scope, id);

    const { api, handler, resources = [], requestValidation } = props;
    const { entryFunctionName, ...handlerProps } = handler;

    this.lambdaFunction = new lambda.NodejsFunction(
      this,
      'IntegratedProxyLambda',
      { ...getDefaultLambdaProps(entryFunctionName), ...handlerProps }
    );
    const lambdaIntegration = new apigw.LambdaIntegration(this.lambdaFunction, {
      proxy: true,
      allowTestInvoke: false
    });

    for (let { method, path = '/' } of resources) {
      const resource = path
        .split('/')
        .filter((part) => part)
        .reduce<apigw.IResource>((res, pathPart) => {
          return res.getResource(pathPart) || res.addResource(pathPart);
        }, api.root);

      const requestModels: { [param: string]: apigw.IModel } = {};
      if (requestValidation?.schema) {
        requestModels['application/json'] = api.addModel(
          `Model-${method}-${path}`,
          { schema: requestValidation.schema }
        );
      }

      resource.addMethod(method, lambdaIntegration, {
        apiKeyRequired: true,
        requestModels,
        requestParameters: requestValidation?.requestParameters,
        requestValidator: requestValidation?.requestValidator
      });
    }
  }
}
