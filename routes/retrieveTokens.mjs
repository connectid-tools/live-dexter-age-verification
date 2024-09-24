import express from 'express';
import RelyingPartyClientSdk from '@connectid-tools/rp-nodejs-sdk';
import { config } from '../config.js';
import { clearCookies } from '../utils/cookieUtils.mjs';
import { jwtDecode } from 'jwt-decode';

const router = express.Router();
const rpClient = new RelyingPartyClientSdk(config);

let tokenLogs = []; // To store logs for the `/retrieve-tokens` response
let hasLoggedError = false; // Flag to prevent multiple logging

router.get('/retrieve-tokens', async (req, res) => {
  console.info('--- /retrieve-tokens endpoint hit ---');  // Info log for endpoint hit
  hasLoggedError = false;  // Reset flag for each request

  // Extract the authorization code from query params
  const { code } = req.query;
  console.info(`Received code: ${code}`);  // Info log for received code

  // Validate that the authorization code is present
  if (!code) {
    logError('Code parameter is required');
    return res.status(400).json({ error: 'Code parameter is required', logs: tokenLogs });
  }

  // Retrieve necessary cookies for token retrieval
  const { authorisation_server_id, code_verifier, state, nonce } = req.cookies;

  if (!authorisation_server_id || !code_verifier || !state || !nonce) {
    logWarn('Missing required cookies for token retrieval');  // Warn log for missing cookies
    return res.status(400).json({ error: 'Missing required cookies for token retrieval', logs: tokenLogs });
  }

  try {
    console.info('Getting tokens');  // Info log for starting token retrieval
    const tokenSet = await rpClient.retrieveTokens(
      authorisation_server_id,
      req.query,
      code_verifier,
      state,
      nonce
    );
    console.info('Tokens successfully retrieved');  // Info log for successful token retrieval

    // Handle the successful token retrieval
    const claims = tokenSet.claims();
    const token = {
      decoded: jwtDecode(tokenSet.id_token),
      raw: tokenSet.id_token,
    };

    tokenLogs = []; // Clear previous logs

    // Success path: Log the success
    tokenLogs.push({ type: 'Success', message: 'Token retrieved successfully', timestamp: new Date() });

    // Clear cookies before returning a successful response
    clearCookies(res);
    console.info('Cookies cleared successfully');  // Info log for successful cookie clearance
    
    // Return success response
    return res.status(200).json({
      claims,
      token,
      logs: tokenLogs,
      xFapiInteractionId: tokenSet.xFapiInteractionId
    });

  } catch (error) {
    if (!hasLoggedError) {
      hasLoggedError = true;
      const sdkErrorMessage = handleFullError(error); // Logs and processes SDK error
      tokenLogs.push({ type: 'Error', message: sdkErrorMessage, timestamp: new Date() });
    }

    // Clear cookies before returning an error response
    clearCookies(res);
    console.warn('Cookies cleared on error');  // Warn log for cookie clearance on error
    
    // Return the full error details, including stack and response
    return res.status(500).json({
      error: error.message || 'Unknown error occurred',
      sdkErrorDetails: JSON.stringify(handleFullError(error)), // Send SDK error details as a string
      logs: tokenLogs,  // Sends logs to the frontend
    });
  }
});

function logError(message) {
  console.error(message);  // Error log
  tokenLogs.push({ type: 'Error', message, timestamp: new Date() });
}

function logWarn(message) {
  console.warn(message);  // Warn log
  tokenLogs.push({ type: 'Warn', message, timestamp: new Date() });
}

function handleFullError(error) {
  // Capture the full error object from the SDK
  const fullError = {
    message: error.message || 'No message provided',
    stack: error.stack || 'No stack trace available',
    response: error.response ? JSON.stringify(error.response, null, 2) : 'No response object',
    config: error.config || 'No config provided',
    ...error
  };
  
  if (error.response) {
    console.error('SDK returned an error response:', error.response);
    tokenLogs.push({
      type: 'Error',
      message: `SDK Error: ${error.response.data.error_description || 'Unknown error'}`,
      details: error.response.data,
      timestamp: new Date(),
    });
  } else {
    console.error('General error occurred:', fullError);
    tokenLogs.push({
      type: 'Error',
      message: error.message || 'Unknown error occurred',
      details: fullError,
      timestamp: new Date(),
    });
  }

  // Return the full error object to be included in the response
  return JSON.stringify(fullError, null, 2); // Ensure it is stringified when logged or returned
}

export default router;
