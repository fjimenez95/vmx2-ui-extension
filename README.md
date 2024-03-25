# Visual Voicemail for Amazon Connect - UI Extension for VMX2-VoicemailExpress

This application provides a UI for your contact center personnel to manage their voicemail. This UI, built using [React](https://react.dev/), is designed on top of the VMX2-VoicemailExpress solution to simplify reading files from the recordings and transcripts bucket, provide authentication in line with the security profile / permissions provided on Connect, and to give users the ability to read/delete voicemail. This solution leverages Cloudscape, an open-source design to support front-end development. Learn more [here](https://cloudscape.design/).

> :warning: This EXAMPLE has been designed to be published on Amazon Connect’s third-party application example GitHub. This code is provided **AS-IS** and has not gone through any security or well-architected reviews. It is the responsibility of the user to ensure that this solution meets their security standards and complies with their organization's policies. This solution will not be actively maintained. Use at your own discretion and consider adapting it to your specific use case as necessary.

Version: 2024.03.28

## Screenshot

![Visual voicemail for Amazon Connect](https://d1khg2kbc0gpyh.cloudfront.net/3papp/screenshot.jpg)

## Architecture

TODO: Pending screenshot

## Pre-requisites
1. This deployment is dependent on a setup similar to [VMX2-VoicemailExpress](https://github.com/amazon-connect/amazon-connect-salesforce-scv/tree/master/Solutions/VMX2-VoicemailExpress). If you have not already deployed a voicemail solution, talk to your AWS Solution Architect to understand your use case.
1. You must already have an existing S3 bucket where you are storing your voicemail .wav files and .json transcripts. This deployment leverages the tags and file name setup in [VMX2-VoicemailExpress](https://github.com/amazon-connect/amazon-connect-salesforce-scv/tree/master/Solutions/VMX2-VoicemailExpress) to track what voicemails are read, unread, created and deleted. Transcripts in this bucket should follow this JSON schema:
    ```json
        {
            "results": {
            "transcripts": [
                {
                "transcript": "Voicemail testing."
                }
            ]
        }
    ```     
1. Update **vmx_kvs_to_s3.js** in your **VMXKVStoS3** AWS Lambda function deployed from VMX2-VoicemailExpress to tag your recordings with the phone number upon which voicemail was received from. To do this, replace Line 124 with the below line. Ensure proper indenting after pasting into your code.
    ```python
        if (key.startsWith('vmx_lang')||key.startsWith('vmx_queue_arn')||key.startsWith('vmx_from')){
    ```

## New resources required for this application
1. **Amazon DynamoDB** table that will track unread, read, and deleted voicemails.
1. **AWS Lambda function** to be triggered when voicemails and transcripts are inserted and deleted from your S3 bucket. This Lambda function will update your DynamoDB table. When this Lambda function is run, it will also run your **VMXPresigner** Lambda function deployed from [VMX2-VoicemailExpress](https://github.com/amazon-connect/amazon-connect-salesforce-scv/tree/master/Solutions/VMX2-VoicemailExpress). 
1. **AWS IAM role** that is applied to both AWS Lambda function's that includes ability to make read/write to DynamoDB table and also invoke VMXPresigner.
1. **Event notifications** for your existing Amazon S3 buckets where your recordings and transcripts are stored.
1. **AWS Lambda function** to handle API calls from front-end.
1. **AWS API Gateway - Rest API** to handle CRUD designed in AWS Lambda function above.
> :warning: Don't forget that you will need to update VMXKVStoS3 Lambda in VMX2-VoicemailExpress to tag your recordings with phone number. See #3 under Pre-requisites.

## CloudFormation
Want a quicker way to get started? You can deploy the resources above with this CloudFormation template.

### Deployment details
1. **Amazon DynamoDB** table that will track unread, read, and deleted voicemails. The schema for this table:
    ```json
        {
            "contactId": STRING,
            "customer_phone_number": STRING,
            "eventTime": STRING,
            "presigned_url": STRING,
            "read_by_username": STRING,
            "transcript": STRING,
            "unread": BOOLEAN,
            "vmx_lang": STRING,
            "vmx_queue_arn": STRING,
            "vmx_queue_name": STRING
        }
    ```
1. **AWS Lambda function** to be triggered when voicemails and transcripts are inserted and deleted from your S3 bucket. This function is capable of handling events from two distinct S3 buckets:
    * The `RECORDINGS_BUCKET` triggers the creation of new items in the DynamoDB table, including tags such as vmx_queue_arn, vmx_lang, marking them as unread, and including a presigned_url that will be used to play audio from UI. It also handles item deletions.
    * The `TRANSCRIPTS_BUCKET` triggers updates to DynamoDB items, adding a transcript attribute based on the file contents. It also handles item deletions.
    * The following environment variables are required in this lambda function.
        1. `DYNAMODB_TABLE`: CloudFormation will provision a DynamoDB table for you and fill this out.
        2. `RECORDINGS_BUCKET`: This is the S3 bucket where your recordings are dumped. This is created for you as part of the VMX2-VoicemailExpress solution.
        3. `TRANSCRIPTS_BUCKET`: This is the S3 bucket where your transcripts are dumped. This is created for you as part of the VMX2-VoicemailExpress solution.
        4. `PRESIGNER_ARN`: This should come from the VMX2-VoicemailExpress solution. This generates your S3 URL that is used for users to listen to voicemails.
1. **AWS IAM role** that is applied to both AWS Lambda function's that includes ability to make read/write to DynamoDB table and also invoke VMXPresigner.
1. Adds **Event notifications** to your existing Amazon S3 buckets (`RECORDINGS_BUCKET` and `TRANSCRIPTS_BUCKET`) for the following events:
    * s3:ObjectCreated:Put
    * s3:ObjectRemoved:Delete
    * s3:LifecycleExpiration:Delete
1. **AWS Lambda function** to handle API calls from front-end. This will make updates to your DynamoDB table that is tracking which voicemails are read, unread, and available.
    * Actions
        * `READ`: Marks a voicemail as read or unread and updates the DynamoDB table with the username who performed the action.
        * `ONLOAD`: Retrieves voicemail data associated with a user's routing profile queues when the user interface is loaded.
        * `DELETE`: Deletes a voicemail record from the DynamoDB table.
    * Process Flow
        * The `lambda_handler` function is the entry point for the Lambda function, which processes the incoming event to determine the action to perform.
        * Depending on the action specified in the event, the Lambda function calls the appropriate handler (`handle_read_action`, `handle_onload_action`, `handle_delete_action`) to process the request.
        * The function includes error handling for missing parameters or invalid actions, returning appropriate HTTP status codes and error messages.
    * The following environment variables are required in this lambda function.
        1. `DYNAMODB_TABLE`: CloudFormation will provision a DynamoDB table for you and fill this out.
        2. `INSTANCE_ID`: The ID of your Amazon Connect instance.
1. **AWS API Gateway - Rest API** to handle CRUD designed in AWS Lambda function above. This will provide an invoke URL for use in your application. By default, this API has no level of authentication. Note that API Gateway should generally be protected by authorization or api key. Be sure to update this for your use case.

## To get started
1. Run the CloudFormation stack to deploy the resources above. Save the VoicemailAPIEndpoint invoke URL as you will need this in your application.
1. If you haven't already, update **vmx_kvs_to_s3.js** in your **VMXKVStoS3** AWS Lambda function deployed from VMX2-VoicemailExpress to tag your recordings with the phone number upon which voicemail was received from. To do this, replace Line 124 with the below line. Ensure proper indenting after pasting into your code.
    ```python
        if (key.startsWith('vmx_lang')||key.startsWith('vmx_queue_arn')||key.startsWith('vmx_from')){
    ```
1. Test a voicemail. You should see an item created in your newly created DynamoDB table.
1. Clone this repository locally and connect it to a Git repository so that it can be accessed by AWS Amplify such as GitHub, Bitbucket, GitLab (not AWS GitLab), AWS CodeCommit, etc.
1. In your terminal move into the root of the directory cd vmx-ui-extension
1. Install the dependencies for the CDK project by running `npm install`
1. Update the API_URL variable with your invoke URL as an output from the CloudFormation template.
1. Open [AWS Amplify](https://us-east-1.console.aws.amazon.com/amplify/home?region=us-east-1#/) in the same region as your resources and select **New app** > **Host web app**.
1. Connect your source code from a Git repository or upload files.
1. Once deployed, you should be able to access this application from your URL.
1. In AWS Amplify, select **Backend environments** > **Launch Studio**.
1. Select **Authentication** on the left hand pane.
1. Select **Add login mechanism**. Configure your authentication method. You will need to configure sign-up, however you can remove this later - as most users will probably prefer to not have anyone sign up.
    * You can set up a `UserId` attribute under **Add attribute**. You can do this now or do this later in AWS Cognito. This will be required to pull in user information and Amazon Connect routing profile details upon login. This attribute will let UI know which Queues are associated to the routing profile of the user and what emails can be displayed.
