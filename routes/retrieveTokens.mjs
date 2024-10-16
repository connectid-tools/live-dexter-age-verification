import express from 'express';
import RelyingPartyClientSdk from '@connectid-tools/rp-nodejs-sdk';
import { jwtDecode } from 'jwt-decode'; // Assuming you use this for token decoding
import { config } from '../config.js';
import { getLogger } from '../utils/logger.mjs'; // Import the logger

const logger = getLogger('info');  // Create a logger instance with the desired log level
const router = express.Router();
const rpClient = new RelyingPartyClientSdk(config);

router.post('/', async (req, res) => {
  const { code, state, iss, authorisationServerId, codeVerifier, nonce, isStateValid } = req.body;

  if (!code) {
    logger.error('Authorization code missing in request');
    return res.status(400).json({ error: 'Authorization code is required' });
  }
 
    if (!isStateValid) {
      console.error('Invalid state detected in authorization response.');
      // Log the error
      console.log(`State mismatch detected: Received state ${state}`);
      
      // Respond with a 500 error indicating that the state was invalid
      return res.status(500).json({ error: 'Invalid state in authorization response. Token request rejected.' });
  }

  try {
    // Retrieve tokens using cookies or body data
    const tokenSet = await rpClient.retrieveTokens(
      authorisationServerId,
      { code,state, iss },  // Include `iss` in the parameters if required
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