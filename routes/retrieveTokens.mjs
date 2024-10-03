import express from 'express';
import RelyingPartyClientSdk from '@connectid-tools/rp-nodejs-sdk';
import { jwtDecode } from 'jwt-decode'; // Assuming you use this for token decoding
import { config } from '../config.js';
import { getLogger } from '../utils/logger.mjs'; // Import the logger

const logger = getLogger('info');  // Create a logger instance with the desired log level
const router = express.Router();
const rpClient = new RelyingPartyClientSdk(config);

router.get('/', async (req, res) => {
  const { code, state, nonce, codeVerifier, authorisationServerId } = req.body;
  // Check if the authorization code is present in the query
  if (!req.query.code) {
    logger.error('Authorization code missing from query string');
    return res.status(400).json({ error: 'No code parameter in query string' });
  }

  try {
    // First, attempt to retrieve values from cookies
    let authorisationServerId = req.cookies.authorisation_server_id;
    let codeVerifier = req.cookies.code_verifier;
    let state = req.cookies.state;
    let nonce = req.cookies.nonce;

    // Log the cookies that were retrieved (if present)
    logger.info('--- Retrieving tokens with cookies ---');
    logger.info(`- authorisation_server_id: ${authorisationServerId}`);
    logger.info(`- code_verifier: ${codeVerifier}`);
    logger.info(`- state: ${state}`);
    logger.info(`- nonce: ${nonce}`);

    // If cookies are missing, fall back to session values from the request body (sent by the client-side)
    if (!authorisationServerId || !codeVerifier || !state || !nonce) {
      logger.info('Cookies missing, checking sessionStorage values from request body');

      // Fallback to sessionStorage values sent by the client (assumes client sends these values in the body)
      authorisationServerId = req.body.authorisationServerId || null;
      codeVerifier = req.body.codeVerifier || null;
      state = req.body.state || null;
      nonce = req.body.nonce || null;

      // Log the fallback values
      logger.info(`- Fallback authorisation_server_id: ${authorisationServerId}`);
      logger.info(`- Fallback code_verifier: ${codeVerifier}`);
      logger.info(`- Fallback state: ${state}`);
      logger.info(`- Fallback nonce: ${nonce}`);
    }

    // Ensure all the necessary values are present
    if (!authorisationServerId || !codeVerifier || !state || !nonce) {
      return res.status(400).json({ error: 'Missing required values for token retrieval (cookies or session)' });
    }

    // Use the rpClient to retrieve tokens from the authorization server
    const tokenSet = await rpClient.retrieveTokens(
      authorisationServerId,
      req.query,  // This includes the authorization code and state
      codeVerifier,
      state,
      nonce
    );

    // Log the retrieved tokens and claims
    const claims = tokenSet.claims();
    const token = {
      decoded: JSON.stringify(jwtDecode(tokenSet.id_token), null, 2),
      raw: tokenSet.id_token,
    };

    logger.info('Tokens and claims successfully retrieved');
    logger.info(`Decoded ID token: ${token.decoded}`);

    // Return the tokens and claims to the client
    return res.json({ claims, token, xFapiInteractionId: tokenSet.xFapiInteractionId });
  } catch (error) {
    logger.error('Error retrieving tokenset: ' + error.message);
    return res.status(500).json({ error: 'Failed to retrieve tokens', details: error.message });
  }
});

export default router;
