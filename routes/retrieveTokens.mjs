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

  let loggedError = false; 
  let loggedSuccess = false;

  // Extract the authorization code from query params
  const { code } = req.query;
  console.log(`Received code: ${code}`);

  // Validate that the authorization code is present
  if (!code) {
    tokenLogs.push({ type: 'Error', message: 'Code parameter is required', timestamp: new Date() });
    return res.status(400).json({ error: 'Code parameter is required', logs: tokenLogs });
  }

  // Retrieve necessary cookies for token retrieval
  const { authorisation_server_id, code_verifier, state, nonce } = req.cookies;

  if (!authorisation_server_id || !code_verifier || !state || !nonce) {
    tokenLogs.push({ type: 'Error', message: 'Missing required cookies for token retrieval', timestamp: new Date() });
    return res.status(400).json({ error: 'Missing required cookies for token retrieval', logs: tokenLogs });
  }

  try {
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

    if (tokenSet.error_description) {
      console.log(`SDK Error encountered: ${tokenSet.error_description}`);
      tokenLogs.push({ type: 'Error', message: tokenSet.error_description, timestamp: new Date() });
      loggedError = true;
      return res.status(400).json({ error: tokenSet.error_description, logs: tokenLogs });
    }

    // Success path: Log the success and set the `loggedSuccess` flag to true
    tokenLogs.push({ type: 'Success', message: 'Token retrieved successfully', timestamp: new Date() });
    loggedSuccess = true;

    // If no errors, clear cookies and return successful response
    if (loggedSuccess) {
      clearCookies(res); // Clear cookies
      console.log('Cookies cleared successfully');
      return res.status(200).json({
        claims,
        token,
        logs: tokenLogs,
        xFapiInteractionId: tokenSet.xFapiInteractionId
      });
    }

  } catch (error) {
    // Log the entire error object to inspect its structure
    console.error('Error retrieving tokens:', error);

    let errorMessage = 'Unknown error occurred';
    let errorDetails = {};

    // Check if the error response exists
    if (error.response && error.response.data) {
        console.log('Full error response:', error.response.data);
        errorMessage = `SDK Error: ${error.response.data.error_description || 'Unknown SDK error'}`;
        errorDetails = error.response.data;  // Capture full error details
    } else if (error.message) {
        // Handle the case where error has a message property
        errorMessage = `Error: ${error.message}`;
        errorDetails = error;  // Log the entire error object
    } else {
        // Catch any unexpected error structure
        errorMessage = 'Unexpected error structure';
        errorDetails = error; // Log entire error object if no response or message is present
    }

    // Push to tokenLogs array to capture log details
    tokenLogs.push({
      type: 'Error',
      message: errorMessage,
      timestamp: new Date(),
      details: errorDetails // Include full error details in logs
    });

    // Send the error and logs to the frontend
    return res.status(500).json({ error: errorMessage, logs: tokenLogs });
  }
});

export default router;