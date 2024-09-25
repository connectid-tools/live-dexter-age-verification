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
    return await rpClientInstance.retrieveTokens(...args);
  } catch (error) {
    // Get the x-fapi-interaction-id from the error response headers
    const xFapiInteractionId = getXFapiInteractionId(error);

    // Return the error details back to the frontend
    const errorMessage = error.message || 'Error retrieving tokens';
    return { errorMessage, xFapiInteractionId, details: error };
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

    // Check if tokenSet is an error object
    if (tokenSet?.errorMessage) {
      const { errorMessage, xFapiInteractionId, details } = tokenSet;
      clearCookies(res); // Clear cookies before sending the error response
      return res.status(500).json({
        error: errorMessage,
        xFapiInteractionId: xFapiInteractionId,
        details, // Send the error details to the frontend
      });
    }

    // If token retrieval was successful, send the tokens and xFapiInteractionId to the frontend
    const claims = tokenSet.claims();
    const token = {
      decoded: jwtDecode(tokenSet.id_token),
      raw: tokenSet.id_token,
    };
    
    clearCookies(res); // Clear cookies before sending the successful response

    return res.status(200).json({
      claims,
      token,
      xFapiInteractionId: tokenSet.xFapiInteractionId, // Use the successfully retrieved xFapiInteractionId
    });

  } catch (error) {
    // Catch unexpected server errors
    clearCookies(res); // Ensure cookies are cleared before sending the error response
    return res.status(500).json({ error: 'Unexpected server error' });
  }
});

export default router;
