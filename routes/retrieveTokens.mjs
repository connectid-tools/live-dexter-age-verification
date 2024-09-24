import express from 'express';
import RelyingPartyClientSdk from '@connectid-tools/rp-nodejs-sdk';
import { config } from '../config.js';
import { clearCookies } from '../utils/cookieUtils.mjs';
import { jwtDecode } from 'jwt-decode';

const router = express.Router();
const rpClient = new RelyingPartyClientSdk(config);

// Wrap the call to capture internal SDK errors
async function retrieveTokensWithErrorHandling(...args) {
  try {
    return await rpClient.retrieveTokens(...args);
  } catch (error) {
    // Log the error here before it is re-thrown
    console.error('Error inside retrieveTokensWithErrorHandling:', error.message);

    // Optionally capture more error details here (stack, response, etc.)
    const sdkErrorMessage = {
      message: error.message || 'No message provided',
      stack: error.stack || 'No stack trace available',
      response: error.response
        ? JSON.stringify(error.response, null, 2)
        : 'No response object (error occurred before an HTTP request)',
      config: error.config || 'No config provided (error might have occurred before request)',
    };

    // Return the processed error message
    throw sdkErrorMessage; // Throw the processed error message to handle it in the route
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
    clearCookies(res);

    return res.status(500).json({
      error: error.message || 'Unknown error occurred',
      sdkErrorDetails: error,
    });
  }
});

export default router;
