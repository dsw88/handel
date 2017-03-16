const accountConfig = require('../../../lib/util/account-config')(`${__dirname}/../../test-account-config.yml`).getAccountConfig();
const dynamodb = require('../../../lib/services/dynamodb');
const ServiceContext = require('../../../lib/datatypes/service-context');
const DeployContext = require('../../../lib/datatypes/deploy-context');
const PreDeployContext = require('../../../lib/datatypes/pre-deploy-context');
const BindContext = require('../../../lib/datatypes/bind-context');
const AWS = require('aws-sdk-mock');
const sinon = require('sinon');
const expect = require('chai').expect;


describe('dynamodb deployer', function() {
    let sandbox;

    beforeEach(function() {
        sandbox = sinon.sandbox.create();
    });

    afterEach(function() {
        sandbox.restore();
    });

    describe('check', function() {
        it('should require a partition key section', function() {
            let params = {};
            let serviceContext = new ServiceContext("FakeApp", "FakeEnv", "FakeService", "dynamodb", "1", params);
            let errors = dynamodb.check(serviceContext);
            expect(errors.length).to.equal(1);
            expect(errors[0]).to.include("partition_key section is required");
        });

        it('should require a name field in the partition_key', function() {
            let params = {
                partition_key: {
                    type: 'sometype'
                }
            };
            let serviceContext = new ServiceContext("FakeApp", "FakeEnv", "FakeService", "dynamodb", "1", params);
            let errors = dynamodb.check(serviceContext);
            expect(errors.length).to.equal(1);
            expect(errors[0]).to.include("name field in partition_key is required");
        });

        it('should require a type field in the partition_key', function() {
            let params = {
                partition_key: {
                    name: 'somename'
                }
            };
            let serviceContext = new ServiceContext("FakeApp", "FakeEnv", "FakeService", "dynamodb", "1", params);
            let errors = dynamodb.check(serviceContext);
            expect(errors.length).to.equal(1);
            expect(errors[0]).to.include("type field in partition_key is required");
        });
    });

    describe('preDeploy', function() {
        it('should do nothing and just return an empty PreDeployContext', function() {
            let serviceContext = new ServiceContext("FakeApp", "FakeEnv", "FakeService", "FakeType", "1", {});
            return dynamodb.preDeploy(serviceContext)
                .then(preDeployContext => {
                    expect(preDeployContext).to.be.instanceof(PreDeployContext);
                });
        });
    });

    describe('bind', function() {
        it('should do nothing and just return an empty BindContext', function() {
            let ownServiceContext = new ServiceContext("FakeApp", "FakeEnv", "FakeService", "FakeType", "1", {});
            let ownPreDeployContext = new PreDeployContext(ownServiceContext);
            let dependentOfServiceContext = new ServiceContext("FakeApp", "FakeEnv", "OtherService", "OtherType", "1", {});
            let dependentOfPreDeployContext = new PreDeployContext(ownServiceContext);
            return dynamodb.bind(ownServiceContext, ownPreDeployContext, dependentOfServiceContext, dependentOfPreDeployContext)
                .then(bindContext => {
                    expect(bindContext).to.be.instanceof(BindContext);
                });
        });
    });

    describe('deploy', function() {
        it('should create a new table when one doesnt exist', function (){
            let appName = "FakeApp";
            let envName = "FakeEnv";
            let serviceName = "FakeService";
            let serviceType = "FakeType";
            let deployVersion = "1";
            let params = {
                partition_key: {
                    name: "MyPartitionKey",
                    type: "String"
                }
            }
            let ownServiceContext = new ServiceContext(appName, envName, serviceName, serviceType, deployVersion, params);
            let ownPreDeployContext = new PreDeployContext(ownServiceContext);
            let dependenciesDeployContexts = [];

            AWS.mock('DynamoDB', 'describeTable', Promise.reject({
                statusCode: 400,
                code: "ResourceNotFoundException"
            }));
            AWS.mock('DynamoDB', 'createTable', Promise.resolve({}));
            let tableArn = "FakeArn";
            let tableName = "FakeTable";
            AWS.mock('DynamoDB', 'waitFor', Promise.resolve({
                Table: {
                    TableArn: tableArn,
                    TableName: tableName
                }
            }));

            return dynamodb.deploy(ownServiceContext, ownPreDeployContext, dependenciesDeployContexts)
                .then(deployContext => {
                    expect(deployContext).to.be.instanceof(DeployContext);
                    expect(deployContext.policies.length).to.equal(1);
                    expect(deployContext.policies[0].Resource[0]).to.equal(tableArn);
                    let tableNameVar = `DYNAMODB_${appName}_${envName}_${serviceName}_TABLE_NAME`.toUpperCase();
                    expect(deployContext.outputs[tableNameVar]).to.equal(tableName);
                    AWS.restore('DynamoDB');
                });
        });

        it('should not update anything on a table when one already exists', function() {
            let appName = "FakeApp";
            let envName = "FakeEnv";
            let serviceName = "FakeService";
            let serviceType = "FakeType";
            let deployVersion = "1";
            let params = {
                partition_key: {
                    name: "MyPartitionKey",
                    type: "String"
                }
            }
            let ownServiceContext = new ServiceContext(appName, envName, serviceName, serviceType, deployVersion, params);
            let ownPreDeployContext = new PreDeployContext(ownServiceContext);
            let dependenciesDeployContexts = [];

            let tableArn = "FakeArn";
            let tableName = "FakeTable";
            AWS.mock('DynamoDB', 'describeTable', Promise.resolve({
                Table: {
                    TableArn: tableArn,
                    TableName: tableName
                }
            }));

            return dynamodb.deploy(ownServiceContext, ownPreDeployContext, dependenciesDeployContexts)
                .then(deployContext => {
                    expect(deployContext).to.be.instanceof(DeployContext);
                    expect(deployContext.policies.length).to.equal(1);
                    expect(deployContext.policies[0].Resource[0]).to.equal(tableArn);
                    let tableNameVar = `DYNAMODB_${appName}_${envName}_${serviceName}_TABLE_NAME`.toUpperCase();
                    expect(deployContext.outputs[tableNameVar]).to.equal(tableName);
                    AWS.restore('DynamoDB');
                });
        });
    });
});