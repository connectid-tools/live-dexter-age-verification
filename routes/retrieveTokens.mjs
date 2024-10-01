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
  logger.info('--- /retrieve-tokens endpoint hit ---');

  // Log headers for debugging
  logger.info('Request headers:', JSON.stringify(req.headers, null, 2));

  // Extract the authorization code from query params
  const { code } = req.query;
  // logger.info(`Received code: ${code}`);

  // Validate that the authorization code is present
  if (!code) {
    logger.error('Code parameter is missing');
    return res.status(400).json({ error: 'Code parameter is required' });
  }

 // Retrieve necessary cookies for token retrieval
 const { authorisation_server_id, code_verifier, state, nonce } = req.cookies;
 logger.info('Cookies received:');
 logger.info(`authorisation_server_id: ${authorisation_server_id || 'None'}`);
 logger.info(`code_verifier: ${code_verifier || 'None'}`);
 logger.info(`state: ${state || 'None'}`);
 logger.info(`nonce: ${nonce || 'None'}`);

 // Log user-agent for mobile vs desktop issues
 const userAgent = req.headers['user-agent'];
 logger.info(`User-agent: ${userAgent}`);


   // Check if any required cookie is missing
   if (!authorisation_server_id || !code_verifier || !state || !nonce) {
    logger.error('Missing required cookies for token retrieval');
    
    // Return additional details about which cookie is missing
    return res.status(400).json({
      error: 'Missing required cookies for token retrieval',
      missingCookies: {
        authorisation_server_id: authorisation_server_id ? 'Present' : 'Missing',
        code_verifier: code_verifier ? 'Present' : 'Missing',
        state: state ? 'Present' : 'Missing',
        nonce: nonce ? 'Present' : 'Missing',
      }
    });
  }

  try {
    logger.info('Attempting to retrieve tokens with the following details:');
    logger.info(`authorisation_server_id: ${authorisation_server_id}`);
    logger.info(`code_verifier: ${code_verifier}`);
    logger.info(`state: ${state}`);
    logger.info(`nonce: ${nonce}`);

    // Call the rpClient's retrieveTokens method to exchange the code for tokens
    const tokenSet = await rpClient.retrieveTokens(
      authorisation_server_id, // Authorization server ID
      req.query,                // Contains the authorization code (i.e., code)
      code_verifier,           // Code verifier used in the PKCE flow
      state,                   // State to match the original request
      nonce                    // Nonce to match the original request
    );

    logger.info('Tokens successfully retrieved');
    logger.info('Full Token Set:', JSON.stringify(tokenSet, null, 2));

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

    // logger.info(`Returned claims: ${JSON.stringify(claims, null, 2)}`);
    // logger.info(`Returned raw id_token: ${token.raw}`);
    // logger.info(`Returned decoded id_token: ${token.decoded}`);
    // logger.info(`Returned xFapiInteractionId: ${tokenSet.xFapiInteractionId}`);

    // Clear cookies AFTER ensuring the tokens have been retrieved and no further actions need cookies
    clearCookies(res);
    logger.info('Cookies cleared successfully');

    // Return the claims and token info as a response
    logger.info('Returning token and claims info in the response');
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
