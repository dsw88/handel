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
import { ServiceConfig, ServiceEventConsumer, Tags } from 'handel-extension-api';

export interface S3ServiceConfig extends ServiceConfig {
    bucket_name?: string;
    bucket_acl?: string;
    versioning?: string;
    logging?: string;
    lifecycles?: S3Lifecycle[];
}

export interface S3Lifecycle {
    name: string;
    prefix?: string;
    status?: string;
    transitions?: S3LifecycleTransition[];
    version_transitions?: S3LifecycleTransition[];
}

export interface S3LifecycleTransition {
    type: string;
    days?: number;
    date?: string;
}

export interface S3ServiceEventConsumer extends ServiceEventConsumer {
    bucket_events: S3ServiceEventEventsList;
    filters?: S3ServiceEventFilterList;
}

export type S3ServiceEventEventsList = string[];
export type S3ServiceEventFilterList = S3ServiceEventFilter[];

export interface S3ServiceEventFilter {
    name: S3ServiceEventFilterName;
    value: string;
}

export enum S3ServiceEventFilterName {
    SUFFIX = 'suffix',
    PREFIX = 'prefix'
}

export interface HandlebarsS3Template {
    bucketName: string;
    bucketACL?: string;
    versioningStatus: string;
    tags: Tags;
    lifecycle_policy?: HandlebarsS3LifecycleConfig[];
    loggingBucketName?: string;
    logFilePrefix?: string;
}

export interface HandlebarsS3LifecycleConfig {
    name: string;
    prefix: string | undefined;
    status: string;
    expiration_days?: number;
    expiration_date?: string;
    transitions?: HandlebarsS3LifecycleTransition[];
    noncurrent_version_expiration_days?: number | null;
    noncurrent_version_transitions?: HandlebarsS3LifecycleTransition[];
}

export interface HandlebarsS3LifecycleTransition {
    type?: string;
    days?: number;
    date?: string;
}

export interface HandlebarsS3LifecycleTransitionExpiration {
    type?: string;
    value?: string | number;
}
