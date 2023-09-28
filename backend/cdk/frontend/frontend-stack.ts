import {
  RemovalPolicy, Stack, StackProps,
} from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { Bucket, BucketAccessControl } from 'aws-cdk-lib/aws-s3';
import { CloudFrontWebDistribution, OriginAccessIdentity } from 'aws-cdk-lib/aws-cloudfront';
import { ARecord, HostedZone, RecordTarget } from 'aws-cdk-lib/aws-route53';
import { CloudFrontTarget } from 'aws-cdk-lib/aws-route53-targets';
import { DnsValidatedCertificate } from 'aws-cdk-lib/aws-certificatemanager';
import { BucketDeployment, Source } from 'aws-cdk-lib/aws-s3-deployment';
import { FRONTEND_DOMAIN_NAME } from '../common';

export class FrontendStack extends Stack {
  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    const domainName = FRONTEND_DOMAIN_NAME;

    // Create S3 bucket
    const websiteBucket = new Bucket(this, 'WebsiteBucket', {
      bucketName: 'paste.quangdel.com-frontend',
      websiteIndexDocument: 'index.html',
      websiteErrorDocument: 'index.html',
      removalPolicy: RemovalPolicy.DESTROY,
      accessControl: BucketAccessControl.PRIVATE,
    });
    const originAccessIdentity = new OriginAccessIdentity(this, 'OAI');
    websiteBucket.grantRead(originAccessIdentity);

    // TLS certificate
    const hostedZone = HostedZone.fromLookup(this, 'Zone', { domainName: 'quangdel.com' });
    const cert = new DnsValidatedCertificate(this, 'SiteCertificate', {
      domainName,
      hostedZone,
      region: 'us-east-1', // CloudFront only accepts us-east-1 certificates. See: https://github.com/aws/aws-cdk/issues/25343
    });

    // CloudFront distribution
    const distribution = new CloudFrontWebDistribution(this, 'WebsiteDistribution', {
      originConfigs: [
        {
          s3OriginSource: {
            s3BucketSource: websiteBucket,
            originAccessIdentity,
          },
          behaviors: [{ isDefaultBehavior: true }],
        },
      ],
      viewerCertificate: {
        aliases: [FRONTEND_DOMAIN_NAME],
        props: {
          acmCertificateArn: cert.certificateArn,
          sslSupportMethod: 'sni-only',
          minimumProtocolVersion: 'TLSv1.1_2016',
        },
      },
      defaultRootObject: 'index.html',
      errorConfigurations: [
        {
          errorCode: 404,
          responseCode: 200,
          responsePagePath: '/index.html',
          errorCachingMinTtl: 0,
        },
      ],
    });

    // Deploy assets and invalidate CloudFront
    new BucketDeployment(this, 'BucketDeployment', {
      destinationBucket: websiteBucket,
      sources: [Source.asset('../frontend/build')],
      distribution,
      distributionPaths: ['/*'],
    });

    // Domain name DNS record
    const _aRecord = new ARecord(this, 'SiteAliasRecord', {
      recordName: domainName,
      target: RecordTarget.fromAlias(new CloudFrontTarget(distribution)),
      zone: hostedZone,
    });
  }
}
