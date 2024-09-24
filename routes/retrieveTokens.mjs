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
  console.log('--- /retrieve-tokens endpoint hit ---');
  hasLoggedError = false;  // Reset flag for each request

  // Extract the authorization code from query params
  const { code } = req.query;
  console.log(`Received code: ${code}`);

  // Validate that the authorization code is present
  if (!code) {
    logError('Code parameter is required');
    return res.status(400).json({ error: 'Code parameter is required', logs: tokenLogs });
  }

  // Retrieve necessary cookies for token retrieval
  const { authorisation_server_id, code_verifier, state, nonce } = req.cookies;

  if (!authorisation_server_id || !code_verifier || !state || !nonce) {
    logError('Missing required cookies for token retrieval');
    return res.status(400).json({ error: 'Missing required cookies for token retrieval', logs: tokenLogs });
  }

  try {
    console.log('Getting tokens');
    const tokenSet = await rpClient.retrieveTokens(
      authorisation_server_id,
      req.query,
      code_verifier,
      state,
      nonce
    );
    console.log('Tokens successfully retrieved');
    
    // Handle the successful token retrieval
    const claims = tokenSet.claims();
    const token = {
      decoded: jwtDecode(tokenSet.id_token),
      raw: tokenSet.id_token,
    };

    tokenLogs = []; // Clear previous logs

    // Success path: Log the success
    tokenLogs.push({ type: 'Success', message: 'Token retrieved successfully', timestamp: new Date() });

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

    return res.status(500).json({
      error: error.message || 'Unknown error occurred',
      logs: tokenLogs,  // Sends logs to the frontend
    });
  } finally {
    // Always clear cookies whether successful or in error
    clearCookies(res);
    console.log('Cookies cleared');
  }
});

function logError(message) {
  console.log(message);
  tokenLogs.push({ type: 'Error', message, timestamp: new Date() });
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

  // Return a message to be displayed in the logs
  return fullError.message;
}

export default router;
