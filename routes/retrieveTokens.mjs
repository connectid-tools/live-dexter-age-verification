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

  let loggedError = false; // Flag to track if an error has already been logged
  let loggedSuccess = false; // To track if success has been logged

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
    // Catch errors thrown by the SDK
    console.error('Error retrieving tokens:', error);

    // Log and return the error as it is from the SDK
    tokenLogs.push({ type: 'Error', message: `SDK Error: ${error.message}`, timestamp: new Date() });
    return res.status(500).json({ error: error.message, logs: tokenLogs });
  }
});

export default router;
