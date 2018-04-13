/*
 * Copyright 2018 Brigham Young University
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *
 */
import { expect } from 'chai';
import {
    DeployContext,
    PreDeployContext,
    ProduceEventsContext,
    UnDeployContext
} from 'handel-extension-api';
import 'mocha';
import * as sinon from 'sinon';
import config from '../../../src/account-config/account-config';
import * as s3Calls from '../../../src/aws/s3-calls';
import * as deletePhasesCommon from '../../../src/common/delete-phases-common';
import * as deployPhaseCommon from '../../../src/common/deploy-phase-common';
import {
    AccountConfig,
    ServiceContext,
    ServiceType,
} from '../../../src/datatypes';
import * as s3 from '../../../src/services/s3';
import { S3ServiceConfig, S3ServiceEventConsumer } from '../../../src/services/s3/config-types';
import { STDLIB_PREFIX } from '../../../src/services/stdlib';

describe('s3 deployer', () => {
    const appName = 'FakeApp';
    const envName = 'FakeEnv';
    let sandbox: sinon.SinonSandbox;
    let ownServiceContext: ServiceContext<S3ServiceConfig>;
    let serviceParams: S3ServiceConfig;
    let accountConfig: AccountConfig;

    beforeEach(async () => {
        accountConfig = await config(`${__dirname}/../../test-account-config.yml`);
        serviceParams = {
            type: 's3'
        };
        ownServiceContext = new ServiceContext(appName, envName, 'FakeService', new ServiceType(STDLIB_PREFIX, 's3'), serviceParams, accountConfig);
        sandbox = sinon.sandbox.create();
    });

    afterEach(() => {
        sandbox.restore();
    });

    describe('check', () => {
        it('should require the versioning parameter to be a certain value when present', () => {
            ownServiceContext.params = {
                type: 's3',
                bucket_name: 'somename',
                versioning: 'othervalue'
            };
            const errors = s3.check(ownServiceContext, []);
            expect(errors.length).to.equal(1);
            expect(errors[0]).to.contain('\'versioning\' parameter must be either \'enabled\' or \'disabled\'');
        });

        it('should work when there are no configuration errors', () => {
            ownServiceContext.params = {
                type: 's3',
                bucket_name: 'somename',
                versioning: 'enabled'
            };
            const errors = s3.check(ownServiceContext, []);
            expect(errors.length).to.equal(0);
        });

        it('should fail if PublicReadWrite set as an ACL', () => {
            ownServiceContext.params = {
                type: 's3',
                bucket_name: 'somename',
                bucket_acl: 'PublicReadWrite'
            };
            const errors = s3.check(ownServiceContext, []);
            expect(errors.length).to.equal(1);
            expect(errors[0]).to.contain('\'bucket_acl\' parameter must be \'AuthenticatedRead\', \'AwsExecRead\', \'BucketOwnerRead\', \'BucketOwnerFullControl\', \'LogDeliveryWrite\', \'Private\' or \'PublicRead\'');
        });

        it('should work with valid bucket_acl', () => {
            ownServiceContext.params = {
                type: 's3',
                bucket_name: 'somename',
                bucket_acl: 'PublicRead'
            };
            const errors = s3.check(ownServiceContext, []);
            expect(errors.length).to.equal(0);
        });

        describe('deploy', () => {
            it('should deploy the bucket', async () => {
                const bucketName = 'my-bucket';
                ownServiceContext.params = {
                    type: 's3',
                    bucket_name: bucketName
                };
                const preDeployContext = new PreDeployContext(ownServiceContext);

                const deployStackStub = sandbox.stub(deployPhaseCommon, 'deployCloudFormationStack').returns(Promise.resolve({
                    Outputs: [{
                        OutputKey: 'BucketName',
                        OutputValue: bucketName
                    }]
                }));

                const deployContext = await s3.deploy(ownServiceContext, preDeployContext, []);
                expect(deployStackStub.callCount).to.equal(2);
                expect(deployContext).to.be.instanceof(DeployContext);
                expect(deployContext.policies.length).to.equal(2);
                expect(deployContext.environmentVariables.FAKESERVICE_BUCKET_NAME).to.equal(bucketName);
                expect(deployContext.environmentVariables.FAKESERVICE_BUCKET_URL).to.contain(bucketName);
                expect(deployContext.environmentVariables.FAKESERVICE_REGION_ENDPOINT).to.not.equal(null);
            });
        });

        describe('produceEvents', () => {
            const bucketName = 'FakeBucketName';
            const bucketEvents = [
                'FakeEvent'
            ];
            let ownDeployContext: DeployContext;
            let eventConsumerConfig: S3ServiceEventConsumer;

            beforeEach(() => {
                ownDeployContext = new DeployContext(ownServiceContext);
                ownDeployContext.eventOutputs.bucketName = bucketName;
                eventConsumerConfig = {
                    service_name: 'FakeConsumer',
                    bucket_events: bucketEvents
                };
            });

            const servicesToTest = [
                {
                    serviceType: 'lambda',
                    arnPropertyName: 'lambdaArn',
                    arnPropertyValue: 'FakeLambdaArn'
                },
                {
                    serviceType: 'sns',
                    arnPropertyName: 'topicArn',
                    arnPropertyValue: 'FakeTopicArn'
                },
                {
                    serviceType: 'sqs',
                    arnPropertyName: 'queueArn',
                    arnPropertyValue: 'FakeQueueArn'
                }
            ];
            servicesToTest.forEach(serviceToTest => {
                it(`should produce events to the ${serviceToTest} service type`, async () => {
                    const consumerServiceContext = new ServiceContext(appName, envName, 'FakeConsumerService', new ServiceType(STDLIB_PREFIX, serviceToTest.serviceType), {type: serviceToTest.serviceType}, accountConfig);
                    const consumerDeployContext = new DeployContext(consumerServiceContext);
                    consumerDeployContext.eventOutputs[serviceToTest.arnPropertyName] = serviceToTest.arnPropertyValue;

                    const configureBucketNotificationsStub = sandbox.stub(s3Calls, 'configureBucketNotifications').resolves({});

                    const produceEventsContext = await s3.produceEvents(ownServiceContext, ownDeployContext, eventConsumerConfig, consumerServiceContext, consumerDeployContext);
                    expect(configureBucketNotificationsStub.callCount).to.equal(1);
                    expect(configureBucketNotificationsStub.getCall(0).args).to.deep.equal([
                        bucketName,
                        serviceToTest.serviceType,
                        serviceToTest.arnPropertyValue,
                        bucketEvents,
                        []
                    ]);
                    expect(produceEventsContext).to.be.instanceof(ProduceEventsContext);
                });
            });

            it('should throw an error on all other service types', async () => {
                const consumerServiceContext = new ServiceContext(appName, envName, 'FakeConsumerService', new ServiceType(STDLIB_PREFIX, 'someother'), {type: 'someother'}, accountConfig);
                const consumerDeployContext = new DeployContext(consumerServiceContext);

                try {
                    const produceEventsContext = await s3.produceEvents(ownServiceContext, ownDeployContext, eventConsumerConfig, consumerServiceContext, consumerDeployContext);
                    expect(true).to.equal(false); // SHould not get here
                }
                catch(err) {
                    expect(err.message).to.contain('Unsupported event consumer type');
                }
            });
        });

        describe('unDeploy', () => {
            it('should undeploy the stack', async () => {
                const bucketName = 'my-bucket';
                ownServiceContext.params = {
                    type: 's3',
                    bucket_name: bucketName
                };

                const unDeployStackStub = sandbox.stub(deletePhasesCommon, 'unDeployService').returns(Promise.resolve(new UnDeployContext(ownServiceContext)));

                const unDeployContext = await s3.unDeploy(ownServiceContext);
                expect(unDeployContext).to.be.instanceof(UnDeployContext);
                expect(unDeployStackStub.callCount).to.equal(1);
            });
        });
    });
});