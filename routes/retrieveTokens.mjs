import express from 'express';
import RelyingPartyClientSdk from '@connectid-tools/rp-nodejs-sdk';
import { config } from '../config.js';
import { clearCookies } from '../utils/cookieUtils.mjs';
import { jwtDecode } from 'jwt-decode';
import { getLogger } from '../utils/logger.mjs';  // Adjust the path to your logger file

const router = express.Router();
const rpClient = new RelyingPartyClientSdk(config); // This includes the logger from the SDK
const logger = getLogger('info');  // Define the logger

// Simplified function to extract the x-fapi-interaction-id from the error
function getXFapiInteractionId(error) {
  return error?.response?.headers?.['x-fapi-interaction-id'] || 'Unknown';
}

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
    const xFapiInteractionId = getXFapiInteractionId(error);

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
    // Retrieve the token set and handle any errors that occur
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

    return res.status(200).json({
      claims,
      token,
      xFapiInteractionId: tokenSet.xFapiInteractionId, // Use the successfully retrieved xFapiInteractionId
    });

  } catch (error) {
    const xFapiInteractionId = getXFapiInteractionId(error);

    // Log error details once, including xFapiInteractionId
    logger.error('Error during operation:', {
      message: error.message,
      name: error.name,
      stack: error.stack,
      details: error.details || 'No additional details available',
      xFapiInteractionId: xFapiInteractionId,
    });

    // Return error response to the frontend
    return res.status(500).json({
      error: 'Operation failed',
      details: error.message,
      fullError: {
        message: error.message,
        name: error.name,
        stack: error.stack,
        details: error.details || null,
        xFapiInteractionId: xFapiInteractionId, // Include this in your response
      }
    });
  } finally {
    // Clear cookies after response, whether successful or not
    clearCookies(res);
  }
});

export default router;
