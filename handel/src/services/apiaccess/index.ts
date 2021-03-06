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
import * as fs from 'fs';
import {
    DeployContext,
    DeployOutputType,
    PreDeployContext,
    ServiceConfig,
    ServiceContext,
    ServiceDeployer
} from 'handel-extension-api';
import { checkPhase } from 'handel-extension-support';
import * as winston from 'winston';
import * as util from '../../common/util';
import { APIAccessConfig } from './config-types';

const SERVICE_NAME = 'API Access';

function getDeployContext(serviceContext: ServiceContext<APIAccessConfig>): DeployContext {
    const serviceParams = serviceContext.params;
    const deployContext = new DeployContext(serviceContext);

    // Inject policies
    for (const service of serviceParams.aws_services) {
        const statementsPath = `${__dirname}/${service}-statements.json`;
        const serviceStatements = JSON.parse(util.readFileSync(statementsPath));
        for (const serviceStatement of serviceStatements) {
            deployContext.policies.push(serviceStatement);
        }
    }

    return deployContext;
}

export class Service implements ServiceDeployer {
    public readonly producedDeployOutputTypes = [
        DeployOutputType.Policies
    ];
    public readonly consumedDeployOutputTypes = [];
    public readonly producedEventsSupportedTypes = [];
    public readonly providedEventType = null;
    public readonly supportsTagging = false;

    public check(serviceContext: ServiceContext<APIAccessConfig>, dependenciesServiceContexts: Array<ServiceContext<ServiceConfig>>): string[] {
        const errors = checkPhase.checkJsonSchema(`${__dirname}/params-schema.json`, serviceContext);
        if(errors.length === 0) { // If no schema errors, validate that they've asked for supported services
            const serviceParams = serviceContext.params;
            for (const service of serviceParams.aws_services) {
                const statementsPath = `${__dirname}/${service}-statements.json`;
                if (!fs.existsSync(statementsPath)) {
                    errors.push(`The 'aws_service' value '${service}' is not supported`);
                }
            }
        }
        return errors;
    }

    public async deploy(ownServiceContext: ServiceContext<APIAccessConfig>, ownPreDeployContext: PreDeployContext, dependenciesDeployContexts: DeployContext[]): Promise<DeployContext> {
        const stackName = ownServiceContext.stackName();
        winston.info(`${SERVICE_NAME} - Deploying ${SERVICE_NAME} '${stackName}'`);
        return getDeployContext(ownServiceContext);
    }
}
