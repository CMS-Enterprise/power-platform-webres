Inside the IT Governance Dev environment, we have a Power Automate flow called TestCedarDataFlow. The following instructions allow a user to authenticate with Microsoft services using our Service Principal and trigger that Power Automate flow to receive System Intake and Business Case data from the IT Governance Dataverse instance. It uses OAuth2 and should not be accessible to any user except the service principal.

This Postman collection was created to connect the Power Apps Dataverse environment with the Cedar team's systems. We are looking to validate that the Cedar team can successfully connect to this system, but there is remaining work to fill out the data provided by the HTTP request. If Cedar can establish a connection, we will populate the response with the required data fields.

Steps to initiate a connection and make a request:

1. Create a Postman environment
2. This information is currently available in the EASI password manager vault. We will be moving these credentials to the Cedar team for storage in an accessible place for them.
   - tenant_id
   - client_id
   - client_secret
   - flow_trigger_url
3. Run "Authentication" request
   - This retrieves an OAuth2 access token using the Service Principal
   - The token is automatically stored in the Postman environment as "bearer_token"
4. Run "Trigger Power Automate Flow"
   - This sends an authenticated request to the Power Automate HTTP trigger
   - A successful response confirms that the Cedar system can connect to the IT Governance environment
   - The response payload is currently a work in progress.

Notes:

- IMPORTANT: The client_secret used for authentication will expire.
  - The current expiration date for this token is 3/11/2027
  - A new client secret must be generated in Microsoft Entra (App Registration)
  - The updated client_secret must be stored in the password manager
- The Postman environment must be updated with the new value
- This collection can be used for Dev, UAT, Production environments. Environment-specific values (such as flow_trigger_url) must be updated accordingly.
- Service Principal information should remain the same between three environments
- Uses OAuth (no SAS)
- Scope must be https://gov.service.flow.microsoft.us//.default

Troubleshooting:

- If you receive "MisMatchingOAuthClaims":
  - Ensure the scope is set to https://gov.service.flow.microsoft.us//.default - Two slashes is important
  - Ensure the correct Postman environment is selected

- If you receive a 401/403:
  - Re-run the "Authentication" request
  - Confirm credentials are correct in the environment

- If the request fails entirely:
  - Confirm the flow_trigger_url is correct and does not include SAS parameters (sp, sv, sig)

- If authentication fails after previously working:
  - The client_secret may have expired
