const accountConfig = require('../../lib/util/account-config')(`${__dirname}/../test-account-config.yml`).getAccountConfig();
const parserV1 = require('../../lib/deployspec/parser-v1');
const yaml = require('js-yaml');
const fs = require('fs');
const expect = require('chai').expect;

function getDeploySpecFromFile(filePath) {
    return yaml.safeLoad(fs.readFileSync(filePath, 'utf8'));
}


describe('parser-v1', function() {
    describe('validateDeploySpec', function() {
        it('should complain about a missing version', function() {
            let deploySpec = {}
            try {
                parserV1.validateDeploySpec(deploySpec);
                expect(true).to.be.false; //Should not get here
            }
            catch(e) {
                expect(e.message).to.include("'version' field is required");
            }
        });

        it('should complain about a missing name field', function() {
            let deploySpec = {
                version: 1
            }
            try {
                parserV1.validateDeploySpec(deploySpec);
                expect(true).to.be.false; //Should not get here
            }
            catch(e) {
                expect(e.message).to.include("'name' field is required");
            }
        });

        it('should complain about a name field that is too long', function() {
            let deploySpec = {
                version: 1,
                name: "thisfieldiswaytolongofanameanditisgettinglonger"
            }
            try {
                parserV1.validateDeploySpec(deploySpec);
                expect(true).to.be.false; //Should not get here
            }
            catch(e) {
                expect(e.message).to.include("'name' field may not be greater");
            }
        });

        it('should complain about a missing environments field', function() {
            let deploySpec = {
                version: 1,
                name: 'test'
            }
            try {
                parserV1.validateDeploySpec(deploySpec);
                expect(true).to.be.false; //Should not get here
            }
            catch(e) {
                expect(e.message).to.include("'environments' field is required");
            }
        });

        it('should complain about an empty environments field', function() {
            let deploySpec = {
                version: 1,
                name: 'test',
                environments: []
            }
            try {
                parserV1.validateDeploySpec(deploySpec);
                expect(true).to.be.false; //Should not get here
            }
            catch(e) {
                expect(e.message).to.include("'environments' field must contain");
            }
        });

        it('should work on a deploy spec that has valid top-level information', function() {
            let deploySpec = {
                version: 1,
                name: 'test',
                environments: [{}]
            }
            parserV1.validateDeploySpec(deploySpec);
        });
    });

    describe('getEnvironmentContext', function() {
        it("should build the environment context from the deploy spec", function() {
            let deploySpec = {
                version: 1,
                name: 'test',
                environments: {
                    dev: {
                        A: {
                            type: 'dynamodb',
                            some: 'param'
                        }
                    }
                }
            };
            let environmentContext = parserV1.getEnvironmentContext(deploySpec, "dev", "1");
            expect(environmentContext.appName).to.equal('test');
            expect(environmentContext.environmentName).to.equal('dev');
            expect(environmentContext.serviceContexts['A'].serviceType).to.equal('dynamodb');
        });

        it("should throw an error if no service type is specified in any of the services", function() {
            let deploySpec = {
                version: 1,
                name: 'test',
                environments: {
                    dev: {
                        A: {
                            some: 'param'
                        }
                    }
                }
            };
            try {
                let environmentContext = parserV1.getEnvironmentContext(deploySpec, "dev", "1");
                expect(true).to.be.false; //Shouldn't get here
            }
            catch(e) {
                expect(e.message).to.include("This service doesn't have a service type");
            }
        });

        it("should throw an error if an unknown service type is specified.", function() {
            let deploySpec = {
                version: 1,
                name: 'test',
                environments: {
                    dev: {
                        A: {
                            type: 'david',
                            some: 'param'
                        }
                    }
                }
            };
            try {
                let environmentContext = parserV1.getEnvironmentContext(deploySpec, "dev", "1");
                expect(true).to.be.false; //Shouldn't get here
            }
            catch(e) {
                expect(e.message).to.include("Invalid or unsupported service type");
            }
        });
    });
});