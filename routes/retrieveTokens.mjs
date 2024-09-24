import express from 'express';
import RelyingPartyClientSdk from '@connectid-tools/rp-nodejs-sdk';
import { config } from '../config.js';
import { clearCookies } from '../utils/cookieUtils.mjs';
import { jwtDecode } from 'jwt-decode';

const router = express.Router();
const rpClient = new RelyingPartyClientSdk(config);

let tokenLogs = []; // To store logs for the `/retrieve-tokens` response

// Wrap the call to capture internal SDK errors
async function retrieveTokensWithErrorHandling(...args) {
  try {
    return await rpClient.retrieveTokens(...args);
  } catch (error) {
    // Log the error here before it is re-thrown
    console.error('SDK Error occurred:', error.message);
    throw error; // Re-throw the error to be handled by the catch block in the route handler
  }
}

router.get('/retrieve-tokens', async (req, res) => {
  console.info('--- /retrieve-tokens endpoint hit ---');  // Info log for endpoint hit

  // Extract the authorization code from query params
  const { code } = req.query;
  console.info(`Received code: ${code}`);

  // Validate that the authorization code is present
  if (!code) {
    return res.status(400).json({ error: 'Code parameter is required', logs: tokenLogs });
  }

  // Retrieve necessary cookies for token retrieval
  const { authorisation_server_id, code_verifier, state, nonce } = req.cookies;

  if (!authorisation_server_id || !code_verifier || !state || !nonce) {
    return res.status(400).json({ error: 'Missing required cookies for token retrieval', logs: tokenLogs });
  }

  try {
    console.info('Getting tokens');  // Info log for starting token retrieval
    
    // Use the wrapped SDK call to capture any internal errors like `iss` mismatch
    const tokenSet = await retrieveTokensWithErrorHandling(
      authorisation_server_id,
      req.query,
      code_verifier,
      state,
      nonce
    );
    
    console.info('Tokens successfully retrieved');

    // Handle the successful token retrieval
    const claims = tokenSet.claims();
    const token = {
      decoded: jwtDecode(tokenSet.id_token),
      raw: tokenSet.id_token,
    };

    tokenLogs = []; // Clear previous logs
    tokenLogs.push({ type: 'Success', message: 'Token retrieved successfully', timestamp: new Date() });

    // Clear cookies before returning a successful response
    clearCookies(res);
    console.info('Cookies cleared successfully');  // Info log for successful cookie clearance
    
    // Return success response with logs
    return res.status(200).json({
      claims,
      token,
      logs: tokenLogs,  // Include logs in response
      xFapiInteractionId: tokenSet.xFapiInteractionId,
    });

  } catch (error) {
    // Directly log the SDK error
    console.error('This is the first error log:', error);

    // Capture the SDK error message using handleFullError
    const sdkErrorMessage = handleFullError(error);

    // Log the processed error message
    tokenLogs.push({ type: 'Error', message: sdkErrorMessage, timestamp: new Date() });
    
    // Clear cookies before returning an error response
    clearCookies(res);
    
    // Return error response with logs
    return res.status(500).json({
      error: error.message || 'Unknown error occurred',
      sdkErrorDetails: sdkErrorMessage, // Send full SDK error object to frontend
      logs: tokenLogs,
    });
  }
});

// Function to handle full SDK error
function handleFullError(error) {
  // Capture the full error object from the SDK
  const fullError = {
    message: error.message || 'No message provided',
    stack: error.stack || 'No stack trace available',
    response: error.response 
      ? JSON.stringify(error.response, null, 2) 
      : 'No response object (error occurred before an HTTP request)',
    config: error.config 
      ? JSON.stringify(error.config, null, 2) 
      : 'No config provided (error might have occurred before request)',
    ...error
  };

  // Log the structured error details to the console
  console.error('Captured error details:', fullError);

  // If there is an SDK error with a response, return detailed SDK response info
  if (error.response) {
    return JSON.stringify({
      message: `SDK Error: ${error.response.data.error_description || 'Unknown error'}`,
      details: error.response.data,
    }, null, 2);
  }

  // Return a general error message if no SDK response exists
  return JSON.stringify(fullError, null, 2);
}

export default router;
