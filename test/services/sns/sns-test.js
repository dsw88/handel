const accountConfig = require('../../../lib/util/account-config')(`${__dirname}/../../test-account-config.yml`).getAccountConfig();
const sns = require('../../../lib/services/sns');
const cloudfFormationCalls = require('../../../lib/aws/cloudformation-calls');
const ServiceContext = require('../../../lib/datatypes/service-context');
const DeployContext = require('../../../lib/datatypes/deploy-context');
const PreDeployContext = require('../../../lib/datatypes/pre-deploy-context');
const BindContext = require('../../../lib/datatypes/bind-context');
const sinon = require('sinon');
const expect = require('chai').expect;

describe('sns deployer', function() {
    let sandbox;

    beforeEach(function() {
        sandbox = sinon.sandbox.create();
    });

    afterEach(function() {
        sandbox.restore();
    });

    describe('check', function() {
        it('shouldnt validate anything yet', function() {
            let serviceContext = new ServiceContext("FakeApp", "FakeEnv", "FakeService", "FakeType", "1", {});
            let errors = sns.check(serviceContext);
            expect(errors).to.deep.equal([]);
        });
    });

    describe('preDeploy', function() {
        it('should return an empty predeploy context since it doesnt do anything', function() {
            let serviceContext = new ServiceContext("FakeApp", "FakeEnv", "FakeService", "FakeType", "1", {});
            return sns.preDeploy(serviceContext)
                .then(preDeployContext => {
                    expect(preDeployContext).to.be.instanceof(PreDeployContext);
                    expect(preDeployContext.appName).to.equal(serviceContext.appName);
                });
        });
    });

    describe('bind', function() {
        it('should return an empty bind context since it doesnt do anything', function() {
            let serviceContext = new ServiceContext("FakeApp", "FakeEnv", "FakeService", "FakeType", "1", {});
            return sns.bind(serviceContext)
                .then(bindContext => {
                    expect(bindContext).to.be.instanceof(BindContext);
                    expect(bindContext.appName).to.equal(serviceContext.appName);
                });
        });
    });

    describe('deploy', function() {
        it('should create a new topic when one doesnt exist', function() {
            let appName = "FakeApp";
            let envName = "FakeEnv";
            let serviceName = "FakeService";
            let serviceType = "sns";
            let topicName = "FakeTopic";
            let topicArn = "FakeArn";

            let getStackStub = sandbox.stub(cloudfFormationCalls, 'getStack').returns(Promise.resolve(null));
            let createStackStub = sandbox.stub(cloudfFormationCalls, 'createStack').returns(Promise.resolve({
                Outputs: [
                    {
                        OutputKey: 'TopicName',
                        OutputValue: topicName
                    },
                    {
                        OutputKey: 'TopicArn',
                        OutputValue: topicArn
                    }
                ]
            }));

            let ownServiceContext = new ServiceContext(appName, envName, serviceName, serviceType, "1", {
                type: 'sns'
            });
            let ownPreDeployContext = new PreDeployContext(ownServiceContext);

            return sns.deploy(ownServiceContext, ownPreDeployContext, [])
                .then(deployContext => {
                    expect(getStackStub.calledOnce).to.be.true;
                    expect(createStackStub.calledOnce).to.be.true;

                    expect(deployContext).to.be.instanceof(DeployContext);

                    //Should have exported 2 env vars
                    let topicNameEnv = `${serviceType}_${appName}_${envName}_${serviceName}_TOPIC_NAME`.toUpperCase()
                    expect(deployContext.environmentVariables[topicNameEnv]).to.equal(topicName);
                    let topicArnEnv = `${serviceType}_${appName}_${envName}_${serviceName}_TOPIC_ARN`.toUpperCase()
                    expect(deployContext.environmentVariables[topicArnEnv]).to.equal(topicArn);

                    //Should have exported 1 policy
                    expect(deployContext.policies.length).to.equal(1); //Should have exported one policy
                    expect(deployContext.policies[0].Resource[0]).to.equal(topicArn);
                });
        });

        it('should update the topic if it already exists', function() {
            let appName = "FakeApp";
            let envName = "FakeEnv";
            let serviceName = "FakeService";
            let serviceType = "sns";
            let topicName = "FakeTopic";
            let topicArn = "FakeArn";

            let getStackStub = sandbox.stub(cloudfFormationCalls, 'getStack').returns(Promise.resolve({}));
            let updateStackStub = sandbox.stub(cloudfFormationCalls, 'updateStack').returns(Promise.resolve({
                Outputs: [
                    {
                        OutputKey: 'TopicName',
                        OutputValue: topicName
                    },
                    {
                        OutputKey: 'TopicArn',
                        OutputValue: topicArn
                    }
                ]
            }));

            let ownServiceContext = new ServiceContext(appName, envName, serviceName, serviceType, "1", {
                type: 'sns'
            });
            let ownPreDeployContext = new PreDeployContext(ownServiceContext);

            return sns.deploy(ownServiceContext, ownPreDeployContext, [])
                .then(deployContext => {
                    expect(getStackStub.calledOnce).to.be.true;
                    expect(updateStackStub.calledOnce).to.be.true;

                    expect(deployContext).to.be.instanceof(DeployContext);

                    //Should have exported 2 env vars
                    let topicNameEnv = `${serviceType}_${appName}_${envName}_${serviceName}_TOPIC_NAME`.toUpperCase()
                    expect(deployContext.environmentVariables[topicNameEnv]).to.equal(topicName);
                    let topicArnEnv = `${serviceType}_${appName}_${envName}_${serviceName}_TOPIC_ARN`.toUpperCase()
                    expect(deployContext.environmentVariables[topicArnEnv]).to.equal(topicArn);

                    //Should have exported 1 policy
                    expect(deployContext.policies.length).to.equal(1); //Should have exported one policy
                    expect(deployContext.policies[0].Resource[0]).to.equal(topicArn);
                });
        });
    });

    describe('consumerEvents', function() {
        it('should throw an error because SNS cant consume event services', function() {
            return sns.consumeEvents(null, null, null, null)
                .then(consumeEventsContext => {
                    expect(true).to.be.false; //Shouldnt get here
                })
                .catch(err => {
                    expect(err.message).to.contain("SNS service doesn't consume events");
                });
        });
    });

    describe('produceEvents', function() {
        it('should throw an error because SNS cant produce events for other services', function() {
            return sns.produceEvents(null, null, null, null)
                .then(produceEventsContext => {
                    expect(true).to.be.false; //Shouldnt get here
                })
                .catch(err => {
                    expect(err.message).to.contain("SNS service doesn't produce events");
                });
        });
    });
});