import express from 'express';
import RelyingPartyClientSdk from '@connectid-tools/rp-nodejs-sdk';
import { config } from '../config.js';
import { clearCookies } from '../utils/cookieUtils.mjs';
import { jwtDecode } from 'jwt-decode';

const router = express.Router();
const rpClient = new RelyingPartyClientSdk(config);

let tokenLogs = []; // To store logs for the `/retrieve-tokens` response

router.get('/retrieve-tokens', async (req, res) => {
  console.log('--- /retrieve-tokens endpoint hit ---');

  // Extract the authorization code from query params
  const { code } = req.query;
  console.log(`Received code: ${code}`);

  // Validate that the authorization code is present
  if (!code) {
    tokenLogs.push({ type: 'Error', message: 'Code parameter is required', timestamp: new Date() });
    clearCookies(res); // Clear cookies even if there's an error
    return res.status(400).json({ error: 'Code parameter is required', logs: tokenLogs });
  }

  // Retrieve necessary cookies for token retrieval
  const { authorisation_server_id, code_verifier, state, nonce } = req.cookies;

  if (!authorisation_server_id || !code_verifier || !state || !nonce) {
    tokenLogs.push({ type: 'Error', message: 'Missing required cookies for token retrieval', timestamp: new Date() });
    clearCookies(res); // Clear cookies even if there's an error
    return res.status(400).json({ error: 'Missing required cookies for token retrieval', logs: tokenLogs });
  }

  try {
    // Call the SDK to retrieve tokens
    const tokenSet = await rpClient.retrieveTokens(
      authorisation_server_id,
      req.query,
      code_verifier,
      state,
      nonce
    );

    const claims = tokenSet.claims();
    const token = {
      decoded: jwtDecode(tokenSet.id_token),
      raw: tokenSet.id_token,
    };

    tokenLogs = []; // Clear previous logs

    // Handle SDK errors within the token set
    if (tokenSet.error_description) {
      console.log(`SDK Error encountered: ${tokenSet.error_description}`);
      tokenLogs.push({ type: 'Error', message: tokenSet.error_description, timestamp: new Date() });
      clearCookies(res); // Clear cookies even if there's an error
      return res.status(400).json({ error: tokenSet.error_description, logs: tokenLogs });
    }

    // Success path: Log the success
    tokenLogs.push({ type: 'Success', message: 'Token retrieved successfully', timestamp: new Date() });

    // Clear cookies and return success response
    clearCookies(res); 
    console.log('Cookies cleared successfully');
    return res.status(200).json({
      claims,
      token,
      logs: tokenLogs,
      xFapiInteractionId: tokenSet.xFapiInteractionId
    });

  } catch (error) {
    console.error('Error retrieving tokens:', error);

    let errorMessage = 'Unknown error occurred';
    let errorDetails = {};
    let errorObject = {};
    let xFapiInteractionId = 'No interaction ID'; // Default if not found

    // Capture full error object for detailed logging
    const fullError = {
      message: error.message || 'No message provided',
      stack: error.stack || 'No stack trace available',
      response: error.response ? JSON.stringify(error.response, null, 2) : 'No response object',
      config: error.config || 'No config provided',
      ...error
    };
    
    // Check if the error response exists
    if (error.response && error.response.data) {
        const { error: errorCode, error_description, error_uri } = error.response.data;
  
        console.log('Full error response:', error.response.data);
        errorMessage = `SDK Error: ${error_description || 'Unknown SDK error'}`;
        errorDetails = error.response.data;
        
        // Ensure all error components are strings
        errorObject = {
          error: String(errorCode || 'Unknown error'),
          error_description: String(error_description || 'No description provided'),
          error_uri: String(error_uri || 'No URI provided'),
        };

        // Extract x-fapi-interaction-id from the headers if available
        if (error.response.headers && error.response.headers['x-fapi-interaction-id']) {
          xFapiInteractionId = error.response.headers['x-fapi-interaction-id'];
        }
    } else if (error.message) {
        // Handle the case where error has a message property
        errorMessage = `Error: ${error.message}`;
        errorDetails = fullError;  // Log the full error object including stack trace
    } else {
        // Catch any unexpected error structure
        errorMessage = 'Unexpected error structure';
        errorDetails = fullError; // Log entire error object if no response or message is present
    }
  
    tokenLogs.push({
      type: 'Error',
      message: errorMessage,
      timestamp: new Date(),
      details: errorDetails, // Include full error details in logs
      error_object: errorObject, // Include parsed error details
      xFapiInteractionId: xFapiInteractionId // Include the x-fapi-interaction-id
    });
  
    // Send the error, error details, and logs to the frontend
    return res.status(500).json({ 
      error: errorMessage, 
      error_object: errorObject, 
      logs: tokenLogs 
    });
  }
});

export default router;
