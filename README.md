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
    <details>
    <summary>See full code here</summary>

    <pre><code>
        import boto3
        import os
        import urllib.parse
        from datetime import datetime, timezone
        import json
        import logging

        # Initialize logging
        logger = logging.getLogger()
        logger.setLevel(logging.INFO)

        # Constants for the function
        DYNAMODB_TABLE = os.environ['DYNAMODB_TABLE']
        RECORDINGS_BUCKET = os.environ['RECORDINGS_BUCKET']
        TRANSCRIPTS_BUCKET = os.environ['TRANSCRIPTS_BUCKET']
        PRESIGNER_ARN = os.environ['PRESIGNER_ARN']
        INSTANCE_ID = os.environ['INSTANCE_ID']

        # AWS clients
        s3 = boto3.client('s3')
        dynamodb = boto3.resource('dynamodb')
        lambda_client = boto3.client('lambda')
        connect_client = boto3.client('connect')

        def lambda_handler(event, context):
            # Process S3 events for recordings and transcripts.
            # Extract event info
            s3_event = event['Records'][0]['eventName']
            bucket_name = event['Records'][0]['s3']['bucket']['name']
            object_key = urllib.parse.unquote_plus(event['Records'][0]['s3']['object']['key'], encoding='utf-8')
            
            # Ignore non-relevant files
            if should_ignore_file(object_key):
                return
            
            # Process based on bucket and event type
            if bucket_name == RECORDINGS_BUCKET:
                if s3_event.startswith('ObjectCreated'):
                    process_recording_created(bucket_name, object_key)
                elif s3_event.startswith('ObjectRemoved'):
                    handle_file_deletion(object_key)
                    
            elif bucket_name == TRANSCRIPTS_BUCKET:
                if s3_event.startswith('ObjectCreated'):
                    process_transcript_update(bucket_name, object_key)
                elif s3_event.startswith('ObjectRemoved'):
                    handle_file_deletion(object_key)

        def should_ignore_file(object_key):
            # Determine if a file should be ignored based on its key.
            return object_key.startswith('.write_access_check_file') or object_key.endswith('.temp')

        def process_recording_created(bucket_name, object_key):
            # Handle recording creation event: fetch tags, generate presigned URL, and create/update DynamoDB item.
            tags_response = s3.get_object_tagging(Bucket=bucket_name, Key=object_key)
            tags = {tag['Key']: tag['Value'] for tag in tags_response['TagSet']}
            
            presigned_url = generate_presigned_url(RECORDINGS_BUCKET, object_key)
            handle_file_creation(object_key, tags, presigned_url)

        def generate_presigned_url(bucket, object_key):
            # Invoke the Presigner Lambda to generate a presigned URL for the object.
            input_params = {'recording_bucket': bucket, 'recording_key': object_key}
            try:
                lambda_response = lambda_client.invoke(FunctionName=PRESIGNER_ARN, InvocationType='RequestResponse', Payload=json.dumps(input_params))
                response_from_presigner = json.load(lambda_response['Payload'])
                return response_from_presigner.get('presigned_url', '')
            except Exception as e:
                logger.error(f"Failed to generate presigned URL: {e}")
                return None

        def handle_file_creation(object_key, tags, presigned_url):
            # Create or update an item in DynamoDB with recording info and presigned URL.
            contact_id, _ = os.path.splitext(object_key)
            
            vmx_queue_arn = tags.get('vmx_queue_arn', '')
            
            # Determine whether to use the queue name or the agent's username
            queue_or_agent_name = get_queue_or_agent_name(vmx_queue_arn)
            
            item = {
                'contactId': contact_id,
                'eventTime': datetime.utcnow().strftime('%Y-%m-%d %H:%M:%S UTC'),  # Consider using event time if available
                'vmx_queue_arn': vmx_queue_arn,
                'vmx_queue_name': queue_or_agent_name,
                'vmx_lang': tags.get('vmx_lang', ''),
                'unread': True,
                'presigned_url': presigned_url or "N/A",
                'read_by_username': '',
                'customer_phone_number': tags.get('vmx_from', '')
            }
            dynamodb.Table(DYNAMODB_TABLE).put_item(Item=item)

        def handle_file_deletion(object_key):
            # Delete an item from DynamoDB based on the object key.
            contact_id, _ = os.path.splitext(object_key)
            dynamodb.Table(DYNAMODB_TABLE).delete_item(Key={'contactId': contact_id})
            
        def get_queue_or_agent_name(vmx_queue_arn):
            if 'agent/' in vmx_queue_arn:
                # Fetch and return the agent's username
                return get_username_from_arn(vmx_queue_arn)
            else:
                # Fetch and return the queue name for regular queues
                queue_id = vmx_queue_arn.split('/')[-1]
                try:
                    # Make the API call to describe the queue
                    response = connect_client.describe_queue(
                        InstanceId=INSTANCE_ID,
                        QueueId=queue_id
                    )
                    # Extract the queue name from the response
                    print(f"Response {response}")
                    queue_name = response['Queue']['Name']
                    return queue_name
                except Exception as e:
                    print(f"Failed to fetch queue name for Queue ID {queue_id}: {e}")
                    return None

        def process_transcript_update(bucket_name, object_key):
            # Update an existing DynamoDB item with transcript text.
            try:
                response = s3.get_object(Bucket=bucket_name, Key=object_key)
                transcript_content = response['Body'].read().decode('utf-8')
                transcript_data = json.loads(transcript_content)
                transcript_text = transcript_data['results']['transcripts'][0]['transcript']
                
                contact_id, _ = os.path.splitext(object_key)
                table = dynamodb.Table(DYNAMODB_TABLE)
                table.update_item(
                    Key={'contactId': contact_id},
                    UpdateExpression='SET transcript = :transcript',
                    ExpressionAttributeValues={':transcript': transcript_text},
                )
                logger.info(f"Transcript for {contact_id} updated in DynamoDB successfully.")
            except Exception as e:
                logger.error(f"Error processing transcript update for {object_key}: {e}")

        def get_username_from_arn(vmx_queue_arn):
            if 'agent/' in vmx_queue_arn:
                agent_id = vmx_queue_arn.split('/agent/')[1]
                try:
                    response = connect_client.describe_user(UserId=agent_id, InstanceId=INSTANCE_ID)
                    return response['User']['Username']
                except connect_client.exceptions.ResourceNotFoundException:
                    print(f"User or instance not found for ARN: {vmx_queue_arn}")
                    return None
            return None
        </code></pre>

    </details>
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
    <details>
    <summary>See full code here</summary>

    <pre><code>
          import boto3
          import json
          import os

          # Initialize DynamoDB client
          dynamodb = boto3.client('dynamodb')
          DYNAMODB_TABLE = os.environ['DYNAMODB_TABLE']

          # Initialize Amazon Connect client
          connect_client = boto3.client('connect')

          def lambda_handler(event, context):
              print("Received event:", event)
              
              # Parse the JSON body from the event object
              try:
                  body = json.loads(event.get('body', '{}'))
              except json.JSONDecodeError:
                  return {
                      'statusCode': 400,
                      'body': json.dumps({'error': 'Invalid JSON'}),
                      'headers': {'Content-Type': 'application/json'}
                  }
              
              if 'action' in body:
                  user_id = body.get('userId')
                  action = body.get('action')
                  instance_id = os.environ['INSTANCE_ID']

                  if action == 'READ':
                      username = body.get('username')
                      contact_id = body.get('contactId')
                      unread = body.get('unread')
                      return handle_read_action(username, contact_id, unread)
                  else:
                      return handle_onload_action(user_id, instance_id)
              else:
                  return {
                      'statusCode': 400,
                      'body': json.dumps({'error': 'Missing parameter'}),
                      'headers': {'Content-Type': 'application/json'}
                  }

          def handle_onload_action(user_id, instance_id):
              routing_profile_id = get_routing_profile_id(user_id, instance_id)
              if not routing_profile_id:
                  return {
                      'statusCode': 400,
                      'body': json.dumps({'error': 'Failed to retrieve routing profile ID'}),
                      'headers': {'Content-Type': 'application/json'}
                  }
              
              queue_arns = list_routing_profile_queues(routing_profile_id, instance_id)
              if not queue_arns:
                  return {
                      'statusCode': 400,
                      'body': json.dumps({'error': 'Failed to retrieve queue ARNs'}),
                      'headers': {'Content-Type': 'application/json'}
                  }
              
              voicemails = search_voicemails(user_id, queue_arns, instance_id)
              
              return {
                  'statusCode': 200,
                  'headers': {'Content-Type': 'application/json'},
                  'body': json.dumps(voicemails)
              }

          def handle_read_action(username, contact_id, unread):
              # Update the DynamoDB item with read by username and unread status
              try:
                  response = dynamodb.update_item(
                      TableName=DYNAMODB_TABLE,
                      Key={'contactId': {'S': contact_id}},
                      UpdateExpression='SET read_by_username = :username, unread = :unread',
                      ExpressionAttributeValues={
                          ':username': {'S': username},
                          ':unread': {'BOOL': unread}
                      },
                      ReturnValues='ALL_NEW'  # Returns all of the attributes of the item after the update
                  )
                  
                  # Construct a response with the updated item
                  updated_item = {
                      'contactId': response['Attributes']['contactId']['S'],
                      'eventTime': response['Attributes']['eventTime']['S'],
                      'vmx_queue_arn': response['Attributes']['vmx_queue_arn']['S'],
                      'vmx_lang': response['Attributes']['vmx_lang']['S'],
                      'unread': response['Attributes']['unread']['BOOL'],
                      'presigned_url': response['Attributes']['presigned_url']['S'],
                      'transcript': response['Attributes'].get('transcript', {}).get('S', ''),
                      'read_by_username': response['Attributes']['read_by_username']['S'],
                      'customer_phone_number': response['Attributes'].get('customer_phone_number', {}).get('S', '')
                  }

                  return {
                      'statusCode': 200,
                      'body': json.dumps({'message': f'Read action performed for contact ID {contact_id} by user {username}', 'updated_item': updated_item}),
                      'headers': {'Content-Type': 'application/json'}
                  }
              except Exception as e:
                  print(f"Error updating voicemail read status: {e}")
                  return {
                      'statusCode': 500,
                      'body': json.dumps({'error': 'Could not update voicemail unread status'}),
                      'headers': {'Content-Type': 'application/json'}
                  }

          # Helper functions

          def get_routing_profile_id(user_id, instance_id):
              try:
                  response = connect_client.describe_user(UserId=user_id,InstanceId=instance_id)
                  return response['User']['RoutingProfileId']
              except Exception as e:
                  print(f"Error getting routing profile ARN: {e}")
                  return None

          def list_routing_profile_queues(routing_profile_id, instance_id):
              try:
                  response = connect_client.list_routing_profile_queues(
                      InstanceId=instance_id,
                      RoutingProfileId=routing_profile_id
                  )
                  return [queue['QueueId'] for queue in response['RoutingProfileQueueConfigSummaryList']]
              except Exception as e:
                  print(f"Error listing routing profile queues: {e}")
                  return []

          def search_voicemails(user_id, queue_arns, instance_id):
              try:
                  # Fetch queue ARNs associated with the user's routing profile
                  routing_profile_id = get_routing_profile_id(user_id, instance_id)
                  if not routing_profile_id:
                      print("Failed to get routing profile ID")
                      return []

                  queue_arns = list_routing_profile_queues(routing_profile_id, instance_id)
                  if not queue_arns:
                      print("Failed to get queue ARNs")
                      return []

                  # Prepare DynamoDB scan parameters
                  filter_expression = "contains(vmx_queue_arn, :user_id)"
                  expression_attribute_values = {':user_id': {'S': user_id}}

                  for i, queue_arn in enumerate(queue_arns):
                      queue_arn_key = f":queue_arn_{i}"
                      filter_expression += f" OR contains(vmx_queue_arn, {queue_arn_key})"
                      expression_attribute_values[queue_arn_key] = {'S': queue_arn}

                  # Execute the scan
                  response = dynamodb.scan(
                      TableName=DYNAMODB_TABLE,
                      FilterExpression=filter_expression,
                      ExpressionAttributeValues=expression_attribute_values
                  )

                  # Process the response
                  voicemails = []
                  for item in response['Items']:
                      voicemail = {
                          'contactId': item['contactId']['S'],
                          'eventTime': item['eventTime']['S'],
                          'vmx_queue_arn': item['vmx_queue_arn']['S'],
                          'vmx_queue_name': item.get('vmx_queue_name', {}).get('S', ''),
                          'vmx_lang': item['vmx_lang']['S'],
                          'unread': item['unread']['BOOL'],
                          'presigned_url': item['presigned_url']['S'],
                          'transcript': item.get('transcript', {}).get('S', ''),
                          'read_by_username': item.get('read_by_username', {}).get('S', ''),
                          'customer_phone_number': item.get('customer_phone_number', {}).get('S', '')
                      }
                      voicemails.append(voicemail)

                  return voicemails
              except Exception as e:
                  print(f"Error searching voicemails: {e}")
                  return []</code></pre>
    </details>
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
