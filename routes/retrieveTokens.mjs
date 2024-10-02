import express from 'express';
import RelyingPartyClientSdk from '@connectid-tools/rp-nodejs-sdk';
import { jwtDecode } from 'jwt-decode'; // Assuming you use this for token decoding
import { config } from '../config.js';
import { getLogger } from '../utils/logger.mjs'; // Import the logger
import { clearCookies } from '../utils/cookieUtils.mjs'; // Import the clearCookies function

const logger = getLogger('info');  // Create a logger instance with the desired log level
const router = express.Router();
const rpClient = new RelyingPartyClientSdk(config);

router.get('/', async (req, res) => {
  // Check if the authorization code is present in the query
  if (!req.query.code) {
    logger.error('Authorization code missing from query string');
    return res.status(400).json({ error: 'No code parameter in query string' });
  }

  try {
    // Retrieve the cookies set during the /select-bank request
    const authorisationServerId = req.cookies.authorisation_server_id;
    const codeVerifier = req.cookies.code_verifier;
    const state = req.cookies.state;
    const nonce = req.cookies.nonce;

    // Log the cookies that were retrieved
    logger.info('--- Retrieving tokens with cookies ---');
    logger.info(`- authorisation_server_id: ${authorisationServerId}`);
    logger.info(`- code_verifier: ${codeVerifier}`);
    logger.info(`- state: ${state}`);
    logger.info(`- nonce: ${nonce}`);

    // Ensure all the necessary cookies are present
    if (!authorisationServerId || !codeVerifier || !state || !nonce) {
      return res.status(400).json({ error: 'Missing required cookies for token retrieval' });
    }

    // Use the rpClient to retrieve tokens from the authorization server
    const tokenSet = await rpClient.retrieveTokens(
      authorisationServerId,
      req.query,  // This includes the authorization code and state
      codeVerifier,
      state,
      nonce
    );

    logger.info('--- Setting cookies ---');
    logger.info(`- Setting state: ${state}`);
    logger.info(`- Setting nonce: ${nonce}`);
    logger.info(`- Setting code_verifier: ${codeVerifier}`);
    logger.info(`- Setting authorisation_server_id: ${authorisationServerId}`);


    // Extract and log the returned claims and tokens
    const claims = tokenSet.claims();
    const token = {
      decoded: JSON.stringify(jwtDecode(tokenSet.id_token), null, 2),
      raw: tokenSet.id_token,
    };

    // logger.info(`Returned claims: ${JSON.stringify(claims, null, 2)}`);
    // logger.info(`Returned raw id_token: ${token.raw}`);
    // logger.info(`Returned decoded id_token: ${token.decoded}`);
    // logger.info(`Returned xFapiInteractionId: ${tokenSet.xFapiInteractionId}`);

    // Return the tokens and claims to the client
    return res.json({ claims, token, xFapiInteractionId: tokenSet.xFapiInteractionId });
  } catch (error) {
    logger.error('Error retrieving tokenset: ' + error.message);
    return res.status(500).json({ error: 'Failed to retrieve tokens', details: error.message });
  }
});

export default router;
