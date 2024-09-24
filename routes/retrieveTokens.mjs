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
    return res.status(400).json({ error: 'Code parameter is required' });
  }

  // Retrieve necessary cookies for token retrieval
  const { authorisation_server_id, code_verifier, state, nonce } = req.cookies;

  if (!authorisation_server_id || !code_verifier || !state || !nonce) {
    return res.status(400).json({ error: 'Missing required cookies for token retrieval' });
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
// Check for specific errors like `aud` mismatch from the SDK itself
    // You might want to check the tokenSet response for potential error fields
    if (tokenSet.error_description) {
      console.log(`Error from token endpoint: ${tokenSet.error_description}`);
      tokenLogs.push({ type: 'Error', message: tokenSet.error_description, timestamp: new Date() });
      loggedError = true;
      return res.status(400).json({ error: tokenSet.error_description, logs: tokenLogs });
    }

    // Assuming there is a mismatch, log it
    const expectedAud = "https://rp.directory.sandbox.connectid.com.au/openid_relying_party/a849178a-f0a4-45ed-8472-a50c4d5299ae";
    if (token.decoded.aud !== expectedAud) {
      console.log(`Mismatched 'aud' detected: Expected ${expectedAud}, got ${token.decoded.aud}`);
      tokenLogs.push({
        type: 'Error',
        message: `aud mismatch: Expected ${expectedAud}, got ${token.decoded.aud}`,
        timestamp: new Date()
      });
      return res.status(400).json({ error: `aud mismatch: Expected ${expectedAud}, got ${token.decoded.aud}`, logs: tokenLogs });
    }

    // Success path
    return res.status(200).json({ claims, token, logs: tokenLogs });

  } catch (error) {
    // Catch errors thrown by the SDK
    console.error('Error retrieving tokens:', error);

    // Log and return the error as it is from the SDK
    if (error.response && error.response.data) {
      tokenLogs.push({ 
        type: 'Error', 
        message: `SDK Error: ${error.response.data.error_description || 'Unknown error'}`, 
        timestamp: new Date() 
      });
      return res.status(400).json({ error: error.response.data.error_description || 'Unknown error', logs: tokenLogs });
    }

    // Handle any generic errors
    return res.status(500).json({ error: 'Internal server error', logs: tokenLogs });
  }
});
export default router;
