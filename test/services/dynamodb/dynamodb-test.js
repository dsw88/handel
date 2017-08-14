/*
 * Copyright 2017 Brigham Young University
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
const accountConfig = require('../../../lib/common/account-config')(`${__dirname}/../../test-account-config.yml`).getAccountConfig();
const dynamodb = require('../../../lib/services/dynamodb');
const ServiceContext = require('../../../lib/datatypes/service-context');
const DeployContext = require('../../../lib/datatypes/deploy-context');
const PreDeployContext = require('../../../lib/datatypes/pre-deploy-context');
const BindContext = require('../../../lib/datatypes/bind-context');
const deployPhaseCommon = require('../../../lib/common/deploy-phase-common');
const deletePhasesCommon = require('../../../lib/common/delete-phases-common');
const preDeployPhaseCommon = require('../../../lib/common/pre-deploy-phase-common');
const bindPhaseCommon = require('../../../lib/common/bind-phase-common');
const UnPreDeployContext = require('../../../lib/datatypes/un-pre-deploy-context');
const UnBindContext = require('../../../lib/datatypes/un-bind-context');
const UnDeployContext = require('../../../lib/datatypes/un-deploy-context');
const sinon = require('sinon');
const expect = require('chai').expect;

const VALID_DYNAMODB_CONFIG = {
    partition_key: {
        name: "MyPartitionKey",
        type: "String"
    },
    sort_key: {
        name: "MySortKey",
        type: "Number"
    },
    provisioned_throughput: {
        read_capacity_units: "3",
        write_capacity_units: "3"
    },
    global_indexes: [{
        name: "myglobal",
        partition_key: {
            name: "MyPartitionKey",
            type: "String"
        },
        sort_key: {
            name: "MyGlobalSortKey",
            type: "String"
        },
        attributes_to_copy: [
            "MyOtherGlobalAttribute"
        ],
        provisioned_throughput: {
            read_capacity_units: 2,
            write_capacity_units: 2
        }
    }],
    local_indexes: [{
        name: "mylocal",
        sort_key: {
            name: "MyLocalSortKey",
            type: "String"
        },
        attributes_to_copy: [
            "MyOtherLocalAttribute"
        ]
    }],
    tags: {
        name: "MyTagName"
    }
}


describe('dynamodb deployer', function () {
    let sandbox;

    beforeEach(function () {
        sandbox = sinon.sandbox.create();
    });

    afterEach(function () {
        sandbox.restore();
    });

    describe('check', function () {
        let configToCheck;
        let serviceContextToCheck;

        beforeEach(function () {
            configToCheck = JSON.parse(JSON.stringify(VALID_DYNAMODB_CONFIG))
            serviceContextToCheck = new ServiceContext("FakeApp", "FakeEnv", "FakeService", "dynamodb", "1", configToCheck);
        });

        it('should require a partition key section', function () {
            delete configToCheck.partition_key;
            let errors = dynamodb.check(serviceContextToCheck);
            expect(errors.length).to.equal(1);
            expect(errors[0]).to.include("The 'partition_key' section is required");
        });

        it('should require a name field in the partition_key', function () {
            delete configToCheck.partition_key.name;
            let errors = dynamodb.check(serviceContextToCheck);
            expect(errors.length).to.equal(1);
            expect(errors[0]).to.include("The 'name' field in the 'partition_key' section is required");
        });

        it('should require a type field in the partition_key', function () {
            delete configToCheck.partition_key.type;
            let errors = dynamodb.check(serviceContextToCheck);
            expect(errors.length).to.equal(1);
            expect(errors[0]).to.include("The 'type' field in the 'partition_key' section is required");
        });

        it('should require a name field for each global index', function () {
            delete configToCheck.global_indexes[0].name;
            let errors = dynamodb.check(serviceContextToCheck);
            expect(errors.length).to.equal(1);
            expect(errors[0]).to.include("The 'name' field is required in the 'global_indexes' section");
        });

        it('should require the partition_key section in global indexes', function () {
            delete configToCheck.global_indexes[0].partition_key;
            let errors = dynamodb.check(serviceContextToCheck);
            expect(errors.length).to.equal(1);
            expect(errors[0]).to.include("The 'partition_key' section is required in the 'global_indexes' section");
        });

        it('should require the name field in the partition_key for global indexes', function () {
            delete configToCheck.global_indexes[0].partition_key.name;
            let errors = dynamodb.check(serviceContextToCheck);
            expect(errors.length).to.equal(1);
            expect(errors[0]).to.include("The 'name' field in the 'partition_key' section is required in the 'global_indexes' section");
        });

        it('should require the type field in the partition_key section for global indexes', function () {
            delete configToCheck.global_indexes[0].partition_key.type;
            let errors = dynamodb.check(serviceContextToCheck);
            expect(errors.length).to.equal(1);
            expect(errors[0]).to.include("The 'type' field in the 'partition_key' section is required in the 'global_indexes' section");
        });

        it('should require a name field for each local index', function () {
            delete configToCheck.local_indexes[0].name;
            let errors = dynamodb.check(serviceContextToCheck);
            expect(errors.length).to.equal(1);
            expect(errors[0]).to.include("The 'name' field is required in the 'local_indexes' section");
        });

        it('should require the sort_key section in local indexes', function () {
            delete configToCheck.local_indexes[0].sort_key;
            let errors = dynamodb.check(serviceContextToCheck);
            expect(errors.length).to.equal(1);
            expect(errors[0]).to.include("The 'sort_key' section is required in the 'local_indexes' section");
        });

        it('should require the name field in the sort_key for local indexes', function () {
            delete configToCheck.local_indexes[0].sort_key.name;
            let errors = dynamodb.check(serviceContextToCheck);
            expect(errors.length).to.equal(1);
            expect(errors[0]).to.include("The 'name' field in the 'sort_key' section is required in the 'local_indexes' section");
        });

        it('should require the type field in the sort_key section for local indexes', function () {
            delete configToCheck.local_indexes[0].sort_key.type;
            let errors = dynamodb.check(serviceContextToCheck);
            expect(errors.length).to.equal(1);
            expect(errors[0]).to.include("The 'type' field in the 'sort_key' section is required in the 'local_indexes' section");
        });
    });

    describe('preDeploy', function () {
        it('should do nothing and just return an empty PreDeployContext', function () {
            let serviceContext = new ServiceContext("FakeApp", "FakeEnv", "FakeService", "FakeType", "1", {});
            let preDeployNotRequiredStub = sandbox.stub(preDeployPhaseCommon, 'preDeployNotRequired').returns(Promise.resolve(new PreDeployContext(serviceContext)));

            return dynamodb.preDeploy(serviceContext)
                .then(preDeployContext => {
                    expect(preDeployNotRequiredStub.callCount).to.equal(1);
                    expect(preDeployContext).to.be.instanceof(PreDeployContext);
                });
        });
    });

    describe('bind', function () {
        it('should do nothing and just return an empty BindContext', function () {
            let bindNotRequiredStub = sandbox.stub(bindPhaseCommon, 'bindNotRequired').returns(Promise.resolve(new BindContext({}, {})));

            return dynamodb.bind({}, {}, {}, {})
                .then(bindContext => {
                    expect(bindNotRequiredStub.callCount).to.equal(1);
                    expect(bindContext).to.be.instanceof(BindContext);
                });
        });
    });

    describe('deploy', function () {
        let appName = "FakeApp";
        let envName = "FakeEnv";
        let serviceName = "FakeService";
        let serviceType = "dynamodb";
        let deployVersion = "1";
        let params = VALID_DYNAMODB_CONFIG;
        let ownServiceContext = new ServiceContext(appName, envName, serviceName, serviceType, deployVersion, params);
        let ownPreDeployContext = new PreDeployContext(ownServiceContext);
        let dependenciesDeployContexts = [];

        let tableName = "FakeTable";
        let tableArn = `arn:aws:dynamodb:us-west-2:123456789012:table/${tableName}`

        it('should deploy the table', function () {
            let deployStackStub = sandbox.stub(deployPhaseCommon, 'deployCloudFormationStack').returns(Promise.resolve({
                Outputs: [{
                    OutputKey: 'TableName',
                    OutputValue: tableName
                }]
            }));
            return dynamodb.deploy(ownServiceContext, ownPreDeployContext, dependenciesDeployContexts)
                .then(deployContext => {
                    expect(deployStackStub.calledOnce).to.be.true;
                    expect(deployContext).to.be.instanceof(DeployContext);
                    expect(deployContext.policies.length).to.equal(1);
                    expect(deployContext.policies[0].Resource[0]).to.equal(tableArn);
                    let tableNameVar = `${serviceType}_${appName}_${envName}_${serviceName}_TABLE_NAME`.toUpperCase();
                    expect(deployContext.environmentVariables[tableNameVar]).to.equal(tableName);
                });
        });
    });

    describe('consumeEvents', function () {
        it('should throw an error because DynamoDB cant consume event services', function () {
            return dynamodb.consumeEvents(null, null, null, null)
                .then(consumeEventsContext => {
                    expect(true).to.be.false; //Shouldnt get here
                })
                .catch(err => {
                    expect(err.message).to.contain("DynamoDB service doesn't consume events");
                });
        });
    });

    describe('produceEvents', function () {
        it('should throw an error because DynamoDB doesnt yet produce events for other services', function () {
            return dynamodb.produceEvents(null, null, null, null)
                .then(produceEventsContext => {
                    expect(true).to.be.false; //Shouldnt get here
                })
                .catch(err => {
                    expect(err.message).to.contain("DynamoDB service doesn't produce events");
                });
        });
    });

    describe('unPreDeploy', function () {
        it('should return an empty UnPreDeploy context', function () {
            let unPreDeployNotRequiredStub = sandbox.stub(deletePhasesCommon, 'unPreDeployNotRequired').returns(Promise.resolve(new UnPreDeployContext({})));
            return dynamodb.unPreDeploy({})
                .then(unPreDeployContext => {
                    expect(unPreDeployContext).to.be.instanceof(UnPreDeployContext);
                    expect(unPreDeployNotRequiredStub.callCount).to.equal(1);
                });
        });
    });

    describe('unBind', function () {
        it('should return an empty UnBind context', function () {
            let unBindNotRequiredStub = sandbox.stub(deletePhasesCommon, 'unBindNotRequired').returns(Promise.resolve(new UnBindContext({})));
            return dynamodb.unBind({})
                .then(unBindContext => {
                    expect(unBindContext).to.be.instanceof(UnBindContext);
                    expect(unBindNotRequiredStub.callCount).to.equal(1);
                });
        });
    });
    describe('unDeploy', function () {
        it('should undeploy the stack', function () {
            let serviceContext = new ServiceContext("FakeApp", "FakeEnv", "FakeService", "dynamodb", "1", {});
            let unDeployStackStub = sandbox.stub(deletePhasesCommon, 'unDeployService').returns(Promise.resolve(new UnDeployContext(serviceContext)));

            return dynamodb.unDeploy(serviceContext)
                .then(unDeployContext => {
                    expect(unDeployContext).to.be.instanceof(UnDeployContext);
                    expect(unDeployStackStub.calledOnce).to.be.ture;
                });
        });
    });
});
