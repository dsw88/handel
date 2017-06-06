const fs = require('fs');
const ebextensions = require('./ebextensions');
const winston = require('winston');
const uuid = require('uuid');
const util = require('../../common/util');
const os = require('os');
const deployersCommon = require('../../common/deployers-common');
const path = require('path');


function zipDir(dirPath) {
    let zippedPath = `${os.tmpdir()}/${uuid()}.zip`;
    return util.zipDirectoryToFile(dirPath, zippedPath)
        .then(() => {
            return zippedPath;
        });
}

function makeTmpDir() {
    let tempDirPath = `${os.tmpdir()}/${uuid()}`;
    fs.mkdirSync(tempDirPath);
    return tempDirPath;
}

function uploadDeployableArtifactToS3(serviceContext, fileToUpload, fileExtension) {
    let s3FileName = `beanstalk-deployable-${uuid()}.${fileExtension}`;
    winston.info(`Uploading deployable artifact to S3: ${s3FileName}`);
    return deployersCommon.uploadFileToHandelBucket(serviceContext, fileToUpload, s3FileName)
        .then(s3ObjectInfo => {
            winston.info(`Uploaded deployable artifact to S3: ${s3FileName}`);
            return s3ObjectInfo;
        });
}

function prepareAndUploadDir(ownServiceContext, pathToArtifact, ebextensionsToInject) {
    ebextensions.addEbextensionsToDir(ebextensionsToInject, pathToArtifact)
    return zipDir(pathToArtifact)
        .then(fileToUpload => {
            let fileExtension = 'zip';
            return uploadDeployableArtifactToS3(ownServiceContext, fileToUpload, fileExtension)
                .then(s3ArtifactInfo => {
                    //Delete temp zip file
                    fs.unlinkSync(fileToUpload);
                    return s3ArtifactInfo;
                });
        })
        .then(s3ArtifactInfo => {
            ebextensions.deleteAddedEbExtensionsFromDirectory(ebextensionsToInject, pathToArtifact)
            return s3ArtifactInfo;
        });
}

//TODO - This is rather ugly code...
function prepareAndUploadFile(ownServiceContext, pathToArtifact, ebextensionsToInject, fileName) {
    let absArtifactPath = path.resolve(pathToArtifact);
    let artifactDir = path.dirname(absArtifactPath);

    let tempDirPath = makeTmpDir();
    return util.copyFile(pathToArtifact, `${tempDirPath}/${fileName}`)
        .then(() => {
            let userEbextensionsDir = `${artifactDir}/.ebextensions/`;
            if (fs.existsSync(userEbextensionsDir)) {
                return util.copyDirectory(userEbextensionsDir, `${tempDirPath}/.ebextensions/`);
            }
            else {
                return true;
            }
        })
        .then(() => {
            ebextensions.addEbextensionsToDir(ebextensionsToInject, tempDirPath)
            return zipDir(tempDirPath)
        })
        .then(fileToUpload => {
            let fileExtension = 'zip';
            return uploadDeployableArtifactToS3(ownServiceContext, fileToUpload, fileExtension)
                .then(s3ArtifactInfo => {
                    //Delete temp zip file and temp dir
                    fs.unlinkSync(fileToUpload);
                    return s3ArtifactInfo;
                });
        })
        .then(s3ArtifactInfo => {
            util.deleteFolderRecursive(tempDirPath); //Delete the whole temp folder
            return s3ArtifactInfo;
        });
}

function prepareAndUploadWar(pathToArtifact, ebextensionsToInject) {
    //NOTE: THIS CAN BE HANDLED EXACTLY THE SAME WAY AS JAR AND ZIP

    //Copy WAR to new temp one
    //Open up WAR (unzip), inject ebextensions
    //Re-zip dir to new temp WAR
    //Delete temp war
    return Promise.reject(new Error("Not Implemented"));
}

function prepareAndUploadJar(ownServiceContext, pathToArtifact, ebextensionsToInject) {
    let absArtifactPath = path.resolve(pathToArtifact);
    let fileName = path.basename(absArtifactPath);
    return prepareAndUploadFile(ownServiceContext, pathToArtifact, ebextensionsToInject, fileName);
}

function prepareAndUploadZip(ownServiceContext, pathToArtifact, ebextensionsToInject) {
    //NOTE: THIS CAN BE HANDLED EXACTLY THE SAME WAY AS JAR AND WAR

    //Copy zip to temp one
    //Open up zip, inject ebextensions (if any)
    //Upload temp zip
    //Delete temp zip
    return Promise.reject(new Error("Not Implemented"));
}

function prepareAndUploadDockerrun(ownServiceContext, pathToArtifact, ebextensionsToInject, fileName) {
    return prepareAndUploadFile(ownServiceContext, pathToArtifact, ebextensionsToInject, "Dockerrun.aws.json")
}

function prepareAndUploadMisc(ownServiceContext, pathToArtifact, ebextensionsToInject) {
    let absArtifactPath = path.resolve(pathToArtifact);
    let fileName = path.basename(absArtifactPath);
    return prepareAndUploadFile(ownServiceContext, pathToArtifact, ebextensionsToInject, fileName)
}

exports.prepareAndUploadDeployableArtifact = function (ownServiceContext, ebextensionsToInject) {
    let pathToArtifact = ownServiceContext.params.path_to_code;
    let lowerArchivePath = pathToArtifact.toLowerCase();
    let fileStats = fs.lstatSync(pathToArtifact);
    if (fileStats.isDirectory()) { //Dir to upload (zip it up)
        return prepareAndUploadDir(ownServiceContext, pathToArtifact, ebextensionsToInject);
    }
    else if (lowerArchivePath.endsWith('.war')) { //Java WAR file
        return prepareAndUploadWar(ownServiceContext, pathToArtifact, ebextensionsToInject);
    }
    else if (lowerArchivePath.endsWith('.jar')) { //Java JAR file
        return prepareAndUploadJar(ownServiceContext, pathToArtifact, ebextensionsToInject);
    }
    else if (lowerArchivePath.endsWith('.zip')) { //User-managed ZIP file (send up as-is)
        return prepareAndUploadZip(ownServiceContext, pathToArtifact, ebextensionsToInject);
    }
    else if (pathToArtifact.endsWith('Dockerrun.aws.json')) { //Docker to zip up
        return prepareAndUploadDockerrun(ownServiceContext, pathToArtifact, ebextensionsToInject);
    }
    else { //Anything else (Go executable, etc. Zip it up)
        return prepareAndUploadMisc(ownServiceContext, pathToArtifact, ebextensionsToInject);
    }
}