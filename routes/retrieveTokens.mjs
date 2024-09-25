import express from 'express';
import RelyingPartyClientSdk from '@connectid-tools/rp-nodejs-sdk';
import { config } from '../config.js';
import { clearCookies } from '../utils/cookieUtils.mjs';
import { jwtDecode } from 'jwt-decode';
import { getLogger } from '../utils/logger.mjs';  // Adjust the path to your logger file

const router = express.Router();
const rpClient = new RelyingPartyClientSdk(config);

// Initialize the logger
const logger = getLogger('info');

// Extract the x-fapi-interaction-id from the SDK error, if available
function getXFapiInteractionId(error) {
  if (error && error.response && error.response.headers) {
    return error.response.headers['x-fapi-interaction-id'] || 'Unknown';
  }
  return 'Unknown';
}

// Wrap the call to capture internal SDK errors
async function retrieveTokensWithErrorHandling(...args) {
  try {
    return await rpClient.retrieveTokens(...args);
  } catch (error) {
    const xFapiInteractionId = getXFapiInteractionId(error);
    const authorisationServerId = args[0];  // Assuming the first arg is the authorisation server id

    // Log the error when retrieving tokens, including the `iss` value mismatch
    logger.error(
      `Error retrieving tokens with authorisation server ${authorisationServerId}, x-fapi-interaction-id: ${xFapiInteractionId}, ${error.message}`
    );

    // Log full stack trace and details for debugging
    logger.debug({ stack: error.stack, details: error });
    
    throw error;  // Re-throw the processed error message to handle it in the route
  }
}

router.get('/retrieve-tokens', async (req, res) => {
  const { code } = req.query;

  if (!code) {
    return res.status(400).json({ error: 'Code parameter is required' });
  }

  const { authorisation_server_id, code_verifier, state, nonce } = req.cookies;

  if (!authorisation_server_id || !code_verifier || !state || !nonce) {
    return res.status(400).json({ error: 'Missing required cookies for token retrieval' });
  }

  try {
    const tokenSet = await retrieveTokensWithErrorHandling(
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

    clearCookies(res);

    return res.status(200).json({
      claims,
      token,
      xFapiInteractionId: tokenSet.xFapiInteractionId,
    });

  } catch (error) {
    const logs = [
      { type: 'Error', message: error.message, timestamp: new Date() },
      { type: 'Debug', message: error.stack, details: error.details, timestamp: new Date() }
    ];
  
    clearCookies(res);
  
    // Log the error using the logger
    logger.error(`Error occurred: ${error.message}`);
  
    // Return the error and logs to the frontend
    return res.status(500).json({
      error: error.message || 'Unknown error occurred',
      sdkErrorDetails: error,
      logs: logs  // Return logs in the response
    });
  }
});

export default router;
