import { RemovalPolicy, Stack, StackProps } from 'aws-cdk-lib';
import {
  RestApi, LambdaIntegration, SecurityPolicy,
} from 'aws-cdk-lib/aws-apigateway';
import { Certificate, CertificateValidation } from 'aws-cdk-lib/aws-certificatemanager';
import { AttributeType, Table } from 'aws-cdk-lib/aws-dynamodb';
import { NodejsFunction } from 'aws-cdk-lib/aws-lambda-nodejs';
import { ARecord, HostedZone, RecordTarget } from 'aws-cdk-lib/aws-route53';
import { ApiGateway } from 'aws-cdk-lib/aws-route53-targets';
import { Construct } from 'constructs';
import { Bucket, BucketAccessControl } from 'aws-cdk-lib/aws-s3';
import { BACKEND_API_DOMAIN_NAME } from '../common';

export class BackendStack extends Stack {
  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);
    const api = new RestApi(this, BACKEND_API_DOMAIN_NAME, {});

    // Lambda handler for /*
    const backendLambda = new NodejsFunction(this, 'handler', {});
    api.root
      .addResource('{proxy+}')
      .addMethod('ANY', new LambdaIntegration(backendLambda));

    // Add TLS certicate
    const hostedZone = HostedZone.fromLookup(this, 'Zone', { domainName: 'quangdel.com' });
    const cert = new Certificate(this, 'SiteCertificate', {
      domainName: BACKEND_API_DOMAIN_NAME,
      validation: CertificateValidation.fromDns(hostedZone),
    });
    api.addDomainName(BACKEND_API_DOMAIN_NAME, {
      domainName: BACKEND_API_DOMAIN_NAME,
      securityPolicy: SecurityPolicy.TLS_1_2,
      certificate: cert,
    });
    const _aRecord = new ARecord(this, 'ARecord', {
      recordName: BACKEND_API_DOMAIN_NAME,
      zone: hostedZone,
      target: RecordTarget.fromAlias(new ApiGateway(api)),
    });

    // Paste table
    const table = new Table(this, 'PasteTable', {
      partitionKey: { name: 'id', type: AttributeType.STRING },
      tableName: 'pastebin',
      timeToLiveAttribute: 'ttl',
    });
    table.grantReadWriteData(backendLambda);

    // File Upload S3 bucket
    const uploadS3Bucket = new Bucket(this, 'UploadBucket', {
      bucketName: 'paste.quangdel.com-uploads',
      removalPolicy: RemovalPolicy.DESTROY,
      blockPublicAccess: {
        blockPublicAcls: false,
        blockPublicPolicy: false,
        ignorePublicAcls: false,
        restrictPublicBuckets: false,
      },
      accessControl: BucketAccessControl.BUCKET_OWNER_FULL_CONTROL,
    });
    uploadS3Bucket.grantReadWrite(backendLambda);
    uploadS3Bucket.grantPublicAccess();
  }
}
