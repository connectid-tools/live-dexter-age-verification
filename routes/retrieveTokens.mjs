import express from 'express';
import RelyingPartyClientSdk from '@connectid-tools/rp-nodejs-sdk';
import { config } from '../config.js';
import { clearCookies } from '../utils/cookieUtils.mjs';
import { jwtDecode } from 'jwt-decode'
import { getLogger } from '../utils/logger.mjs'; // Import the logger
const logger = getLogger('info');  // Create a logger instance with the desired log level

const router = express.Router();
const rpClient = new RelyingPartyClientSdk(config);

router.get('/', async (req, res) => {
  // logger.log('--- /retrieve-tokens endpoint hit ---');

  // Extract the authorization code from query params
  const { code } = req.query;
  // logger.log(`Received code: ${code}`);

  // Validate that the authorization code is present
  if (!code) {
    logger.error('Code parameter is missing');
    return res.status(400).json({ error: 'Code parameter is required' });
  }

  // Retrieve necessary cookies for token retrieval
  const { authorisation_server_id, code_verifier, state, nonce } = req.cookies;
  // logger.log('Cookies received:');
  // logger.log(`authorisation_server_id: ${authorisation_server_id}`);
  // logger.log(`code_verifier: ${code_verifier}`);
  // logger.log(`state: ${state}`);
  // logger.log(`nonce: ${nonce}`);

  // Check if any required cookie is missing
  if (!authorisation_server_id || !code_verifier || !state || !nonce) {
    logger.error('Missing required cookies for token retrieval');
    return res.status(400).json({ error: 'Missing required cookies for token retrieval' });
  }

  try {
    // logger.log('Attempting to retrieve tokens with the following details:');
    // logger.log(`authorisation_server_id: ${authorisation_server_id}`);
    // logger.log(`code_verifier: ${code_verifier}`);
    // logger.log(`state: ${state}`);
    // logger.log(`nonce: ${nonce}`);

    // Call the rpClient's retrieveTokens method to exchange the code for tokens
    const tokenSet = await rpClient.retrieveTokens(
      authorisation_server_id, // Authorization server ID
      req.query,                // Contains the authorization code (i.e., code)
      code_verifier,           // Code verifier used in the PKCE flow
      state,                   // State to match the original request
      nonce                    // Nonce to match the original request
    );

    // logger.log('Tokens successfully retrieved');
    // logger.log('Full Token Set:', JSON.stringify(tokenSet, null, 2));

    // Check if the state is missing in the response
    // if (!tokenSet.state) {
    //   logger.error('State is missing in the tokenSet response');
    // }

    // Extract the claims and tokens
    const claims = tokenSet.claims();
    const token = {
      decoded: JSON.stringify(jwtDecode(tokenSet.id_token), null, 2),
      raw: tokenSet.id_token,
    };

    // logger.log(`Returned claims: ${JSON.stringify(claims, null, 2)}`);
    // logger.log(`Returned raw id_token: ${token.raw}`);
    // logger.log(`Returned decoded id_token: ${token.decoded}`);
    // logger.log(`Returned xFapiInteractionId: ${tokenSet.xFapiInteractionId}`);

    // Clear cookies AFTER ensuring the tokens have been retrieved and no further actions need cookies
    clearCookies(res);
    // logger.log('Cookies cleared successfully');

    // Return the claims and token info as a response
    // logger.log('Returning token and claims info in the response');
    return res.json({ claims, token, xFapiInteractionId: tokenSet.xFapiInteractionId });
  } catch (error) {
    logger.error('Error retrieving tokenset:', error);
    
    // Return structured error response
    return res.status(500).json({
      error: 'Token Retrieval Failed',
      errorMessage: error.message || 'An unknown error occurred',
      errorCode: error.code || '500'
    });
  }
});

export default router;
