import express from 'express';
import RelyingPartyClientSdk from '@connectid-tools/rp-nodejs-sdk';
import { config } from '../config.js';
import { clearCookies } from '../utils/cookieUtils.mjs';
import { jwtDecode } from 'jwt-decode';
import { getLogger } from '../utils/logger.mjs';  // Adjust the path to your logger file

const router = express.Router();
const rpClient = new RelyingPartyClientSdk(config); // This includes the logger from the SDK

const logger = getLogger('info');  // Define the logger

// Wrap the call to capture internal SDK errors and retrieve the xFapiInteractionId from the tokenSet
async function retrieveTokensWithErrorHandling(rpClientInstance, ...args) {
  try {
    // Retrieve tokens and capture the xFapiInteractionId from the tokenSet
    const tokenSet = await rpClientInstance.retrieveTokens(...args);
    
    // Log success, including the xFapiInteractionId
    rpClientInstance.logger.info(
      `Successfully retrieved tokens, x-fapi-interaction-id: ${tokenSet.xFapiInteractionId}`
    );
    
    return tokenSet;
  } catch (error) {
    const authorisationServerId = args[0];
    const xFapiInteractionId = error.response?.headers['x-fapi-interaction-id'] || 'Unknown';

    // Log the error using the xFapiInteractionId from the error response
    rpClientInstance.logger.error(
      `Error retrieving tokens with authorisation server ${authorisationServerId}, x-fapi-interaction-id: ${xFapiInteractionId}, ${error.message}`
    );

    rpClientInstance.logger.debug({ stack: error.stack, details: error });
    
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
      xFapiInteractionId: tokenSet.xFapiInteractionId, // Use the successfully retrieved xFapiInteractionId
    });

  } catch (error) {
    const xFapiInteractionId = error.response?.headers['x-fapi-interaction-id'] || 'Unknown';
    
    // Log error details
    logger.error('Error during operation:', {
      message: error.message,
      name: error.name,
      stack: error.stack,
      details: error.details || 'No additional details available',
      xFapiInteractionId: xFapiInteractionId,
    });

    // Log the full error object to inspect its structure
    logger.error('Full error object:', error);

    const logs = [
      { type: 'Error', message: error.message || 'Unknown error', timestamp: new Date() },
      { type: 'Debug', message: error.stack || 'No stack trace available', details: error.details || 'No additional details', timestamp: new Date() }
    ];
  
    clearCookies(res);
  
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
