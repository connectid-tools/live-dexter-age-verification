import express from 'express';
import RelyingPartyClientSdk from '@connectid-tools/rp-nodejs-sdk';
import { jwtDecode } from 'jwt-decode'; // Assuming you use this for token decoding
import { config } from '../config.js';
import { getLogger } from '../utils/logger.mjs'; // Import the logger

const logger = getLogger('info');  // Create a logger instance with the desired log level
const router = express.Router();
const rpClient = new RelyingPartyClientSdk(config);

router.post('/', async (req, res) => {
  const { code, state, iss, authorisationServerId, codeVerifier, nonce } = req.body;

  if (!code) {
    logger.error('Authorization code missing in request');
    return res.status(400).json({ error: 'Authorization code is required' });
  }

  try {
    // Retrieve tokens using cookies or body data
    const tokenSet = await rpClient.retrieveTokens(
      authorisationServerId,
      { code, state },
      codeVerifier,
      state,
      nonce
    );

    const claims = tokenSet.claims();
    const token = {
      decoded: JSON.stringify(jwtDecode(tokenSet.id_token), null, 2),
      raw: tokenSet.id_token,
    };

    // Return the decoded token and claims to the frontend
    return res.json({ claims, token, xFapiInteractionId: tokenSet.xFapiInteractionId });
  } catch (error) {
    logger.error('Error retrieving tokenset: ' + error.message);
    return res.status(500).json({ error: 'Failed to retrieve tokens', details: error.message });
  }
});


export default router;