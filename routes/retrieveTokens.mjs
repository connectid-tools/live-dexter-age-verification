import express from 'express';
import RelyingPartyClientSdk from '@connectid-tools/rp-nodejs-sdk';
import { config } from '../config.js';
import { clearCookies } from '../utils/cookieUtils.mjs';
import { jwtDecode } from 'jwt-decode';
import { getLogger } from '../utils/logger.mjs';  // Adjust the path to your logger file

const router = express.Router();
const rpClient = new RelyingPartyClientSdk(config); // This includes the logger from the SDK

// Extract the x-fapi-interaction-id from the SDK error, if available
function getXFapiInteractionId(error) {
  if (error && error.response && error.response.headers) {
    return error.response.headers['x-fapi-interaction-id'] || 'Unknown';
  }
  return 'Unknown';
}

// Wrap the call to capture internal SDK errors
async function retrieveTokensWithErrorHandling(rpClientInstance, ...args) {
  try {
    // Bind the SDK's `retrieveTokens` method to ensure the correct `this` context
    return await rpClientInstance.retrieveTokens.bind(rpClientInstance)(...args);
  } catch (error) {
    const xFapiInteractionId = getXFapiInteractionId(error);
    const authorisationServerId = args[0];

    rpClientInstance.logger.error(
      `Error retrieving tokens with authorisation server ${authorisationServerId}, x-fapi-interaction-id: ${xFapiInteractionId}, ${error.message}`
    );

    rpClientInstance.logger.debug({ stack: error.stack, details: error });
    
    throw error;
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
    // Pass rpClient as the context when calling retrieveTokensWithErrorHandling
    const tokenSet = await retrieveTokensWithErrorHandling(
      rpClient,
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
    const xFapiInteractionId = getXFapiInteractionId(error);
    
    // Use the external logger or SDK's logger here based on your preference.
    // I'll use the external logger for consistency
    logger.error('Error during operation:', {
      message: error.message,
      name: error.name,
      stack: error.stack,
      details: error.details || 'No additional details available',
      xFapiInteractionId: xFapiInteractionId,
    });

    // Log the full error object to inspect its structure
    logger.error('Full error object:', error);

    // Construct logs using only the available properties
    const logs = [
      { type: 'Error', message: error.message || 'Unknown error', timestamp: new Date() },
      { type: 'Debug', message: error.stack || 'No stack trace available', details: error.details || 'No additional details', timestamp: new Date() }
    ];
  
    clearCookies(res);
  
    // Log the error to the backend logger
    logger.error(`Error occurred: ${error.message || 'Unknown error occurred'}`);
  
    // Return the error and logs to the frontend
    return res.status(500).json({
      error: 'Operation failed',
      details: error.message,
      fullError: {
        message: error.message,
        name: error.name,
        stack: error.stack,
        details: error.details || null,
        xFapiInteractionId: xFapiInteractionId, // Include this in your response
      },
      logs: logs  // Return logs in the response
    });
  }
});

export default router;
