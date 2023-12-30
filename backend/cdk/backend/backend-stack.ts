import {
  Duration, RemovalPolicy, Stack, StackProps,
} from 'aws-cdk-lib';
import {
  RestApi, LambdaIntegration, SecurityPolicy,
} from 'aws-cdk-lib/aws-apigateway';
import { Certificate, CertificateValidation } from 'aws-cdk-lib/aws-certificatemanager';
import { AttributeType, Table } from 'aws-cdk-lib/aws-dynamodb';
import { NodejsFunction } from 'aws-cdk-lib/aws-lambda-nodejs';
import { ARecord, HostedZone, RecordTarget } from 'aws-cdk-lib/aws-route53';
import { ApiGateway } from 'aws-cdk-lib/aws-route53-targets';
import { Construct } from 'constructs';
import { Bucket, BucketAccessControl, HttpMethods } from 'aws-cdk-lib/aws-s3';
import {
  BACKEND_API_DOMAIN_NAME, ROOT_DOMAIN_NAME,
  FILE_UPLOAD_S3_BUCKET_NAME, DYNAMODB_TABLE_NAME, FRONTEND_DOMAIN_NAME,
} from '../../src/common';

export class BackendStack extends Stack {
  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);
    const api = new RestApi(this, BACKEND_API_DOMAIN_NAME, {});

    // Lambda handler for /*
    const backendLambda = new NodejsFunction(this, 'handler', {
      timeout: Duration.seconds(5),
    });
    api.root
      .addResource('{proxy+}')
      .addMethod('ANY', new LambdaIntegration(backendLambda));

    // Add TLS certicate
    const hostedZone = HostedZone.fromLookup(this, 'Zone', { domainName: ROOT_DOMAIN_NAME });
    const cert = new Certificate(this, 'SiteCertificate', {
      domainName: BACKEND_API_DOMAIN_NAME,
      validation: CertificateValidation.fromDns(hostedZone),
    });
    api.addDomainName(BACKEND_API_DOMAIN_NAME, {
      domainName: BACKEND_API_DOMAIN_NAME,
      securityPolicy: SecurityPolicy.TLS_1_2,
      certificate: cert,
    });
    new ARecord(this, 'ARecord', {
      recordName: BACKEND_API_DOMAIN_NAME,
      zone: hostedZone,
      target: RecordTarget.fromAlias(new ApiGateway(api)),
    });

    // Paste table
    const table = new Table(this, DYNAMODB_TABLE_NAME, {
      partitionKey: { name: 'id', type: AttributeType.STRING },
      tableName: DYNAMODB_TABLE_NAME,
      timeToLiveAttribute: 'ttl',
    });
    table.grantReadWriteData(backendLambda);

    // File Upload S3 bucket
    const uploadS3Bucket = new Bucket(this, 'UploadBucket', {
      bucketName: FILE_UPLOAD_S3_BUCKET_NAME,
      removalPolicy: RemovalPolicy.DESTROY,
      blockPublicAccess: {
        blockPublicAcls: false,
        blockPublicPolicy: false,
        ignorePublicAcls: false,
        restrictPublicBuckets: false,
      },
      accessControl: BucketAccessControl.BUCKET_OWNER_FULL_CONTROL,
      cors: [
        {
          allowedMethods: [
            HttpMethods.PUT,
            HttpMethods.POST,
            HttpMethods.GET,
          ],
          allowedOrigins: [`https://${FRONTEND_DOMAIN_NAME}`, 'http://localhost:3000'],
          allowedHeaders: ['*'],
        },
      ],
    });
    uploadS3Bucket.grantReadWrite(backendLambda);
    uploadS3Bucket.grantPublicAccess();
  }
}
