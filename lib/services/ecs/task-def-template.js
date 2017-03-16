const util = require('../../util/util');

function injectEnvVarsFromObjectIntoTaskDef(taskDefEnvVars, object) {
    for(let envVarName in object) {
        taskDefEnvVars.push({
            "name": envVarName,
            "value": object[envVarName]
        });
    }
}

function getDependenciesDeployContextEnvVars(dependenciesDeployContexts) {
    return dependenciesDeployContexts.map(deployContext => {
        return deployContext['outputs'];
    })
    .reduce((acc, currentDeployContextOutputs) => {
        for(let key in currentDeployContextOutputs) {
            acc[key] = currentDeployContextOutputs[key];
        }
        return acc;
    }, {});
}

function getDependenciesDeployContextMountPoints(dependenciesDeployContexts) {
    return dependenciesDeployContexts.filter(function(deployContext) {
        if(deployContext['serviceType'] === 'efs') { //Only EFS is supported as an external service mount point for now
            return true;
        }
        return false;
    }).map(function(deployContext) {
        let envVarKeyPrefix = util.getEnvVarKeyPrefix(deployContext);

        return {
            mountDir: deployContext.outputs[`${envVarKeyPrefix}_MOUNT_DIR`],
            name: envVarKeyPrefix
        }
    });
}

exports.getTaskDefinition = function(serviceContext, taskRoleArn, dependenciesDeployContexts) {
    let ecsParams = serviceContext.params;
    let ecsName = `${serviceContext.appName}-${serviceContext.environmentName}-${serviceContext.serviceName}`
    let imageName = `${ecsParams['image_name']}:${serviceContext['deployVersion']}`;

    let maxMb = ecsParams.max_mb || 128;
    let cpuUnits = ecsParams.cpu_units || 100;

    let taskDefinition = {
        family: ecsName,
        taskRoleArn: taskRoleArn,
        networkMode: "bridge",
        containerDefinitions: [{
            name: ecsName,
            image: imageName,
            memory: maxMb,
            cpu: cpuUnits,
            essential: true,
            privileged: false,
            portMappings: [], //Added dynamically below for multiple ports
            environment: [], //Added dynamically below for multiple env vars
            mountPoints: [], //Added dynamically below for multiple mount points
            disableNetworking: false, //Remainder of params not supported at this time
        }],
        placementConstraints: [],
        volumes: [], //Added dynamically below for multiple volumes
    }

    //Add port mappings to container definitions
    for(let portToMap of ecsParams['port_mappings']) {
        taskDefinition.containerDefinitions[0].portMappings.push({
            containerPort: portToMap,
            protocol: "tcp"
        });
    }

    let taskDefEnvVars = taskDefinition.containerDefinitions[0].environment;
    //Inject env vars defined by service
    injectEnvVarsFromObjectIntoTaskDef(taskDefEnvVars, ecsParams['environment_variables']);
    //Inject env vars from service dependencies
    let dependenciesEnvVars = getDependenciesDeployContextEnvVars(dependenciesDeployContexts);
    injectEnvVarsFromObjectIntoTaskDef(taskDefEnvVars, dependenciesEnvVars);


    //TODO - Add volumes and associated mount points defined by service

    //Add volumes and mount points from service dependencies
    let taskDefMountPoints = taskDefinition.containerDefinitions[0].mountPoints
    taskDefMountPoints = taskDefMountPoints.concat(getDependenciesDeployContextMountPoints(dependenciesDeployContexts))
    for(let taskDefMountPoint of taskDefMountPoints) {
        taskDefinition.volumes.push({
            host: {
                sourcePath: taskDefMountPoint.mountDir                
            },
            name: taskDefMountPoint.name
        });

        taskDefinition.containerDefinitions[0].mountPoints.push({
            containerPath: taskDefMountPoint.mountDir,
            sourceVolume: taskDefMountPoint.name
        })
    }

    //TODO - add placement constraints (if any)

    return taskDefinition;
}