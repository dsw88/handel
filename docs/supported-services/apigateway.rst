API Gateway
===========
This document contains information about the API Gateway service supported in Handel. This Handel service provisions resources such as API Gateway and Lambda to provide a serverless HTTP application.

Service Limitations
-------------------

Only Proxy Service
~~~~~~~~~~~~~~~~~~
This service will currently only provision an API that serves as a proxy for a single Lambda function. The API gateway has exactly one handler: 

.. code-block:: none

    ANY on /{proxy+} # Routes all HTTP methods on any route to a single Lambda.

This means all your routing will have to be done inside the Lambda from the passed-in information.

If there is interest, there could be future support for API gateway specified by a Swagger document with some custom extensions that would allow you to tell what resources should be hosted by which lambdas.

No Authorizer Lambdas
~~~~~~~~~~~~~~~~~~~~~
This service doesn't yet support specifying authorizer lambdas.

No VPC Support
~~~~~~~~~~~~~~
This service does not yet support running the Lambdas inside a VPC. It is easily added, but was not required by any apps thus far.

Parameters
----------

.. list-table::
   :header-rows: 1

   * - Parameter
     - Type
     - Required
     - Default
     - Description
   * - path_to_code
     - string
     - Yes
     - 
     - The path to the directory or artifact where your code resides.
   * - lambda_runtime
     - string
     - Yes
     - 
     - The Lambda runtime (such as nodejs6.10) to use for your handler function.
   * - handler_function
     - string
     - Yes
     - 
     - The function to call (such as index.handler) in your deployable code when invoking the Lambda. This is the Lambda-equivalent of your 'main' method.
   * - provisioned_memory
     - number
     - No
     - 128
     - The amount of memory (in MB) to provision for the runtime.
   * - function_timeout
     - string
     - No
     - 3
     - The timeout to use for your Lambda function. Any functions that go over this timeout will be killed.
   * - environment_variables
     - map
     - No
     - {}
     - A set of key/value pairs to set as environment variables on your API.

Example Handel File
-------------------
This Handel file shows an API Gateway service being configured:

.. code-block:: yaml

    version: 1

    name: my-apigateway-app

    environments:
    dev:
        app:
        type: apigateway
        path_to_code: .
        lambda_runtime: nodejs6.10
        handler_function: index.handler
        provisioned_memory: 256
        function_timeout: 5
        environment_variables:
            MY_FIRST_VAR: my_first_value
            MY_SECOND_VAR: my_second_value

Depending on this service
-------------------------
The API Gateway service cannot be referenced as a dependency for another Handel service

Events produced by this service
-------------------------------
The API Gateway service does not produce events for other Handel services to consume.

Events consumed by this service
-------------------------------
The API Gateway service does not consume events from other Handel services.