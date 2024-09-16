import express from 'express';
import RelyingPartyClientSdk from '@connectid-tools/rp-nodejs-sdk';
import { decode as jwtDecode } from 'jwt-decode';  // Import the named export "decode" and alias it to jwtDecode
import { config } from '../config.js';

const router = express.Router();
const rpClient = new RelyingPartyClientSdk(config);

router.get('/retrieve-tokens', async (req, res) => {
  const cartId = req.query.cartId;
  const code = req.query.code;

  if (!code || !cartId) {
    return res.status(400).json({ error: 'Code parameter and cartId are required' });
  }

  const authorisationServerId = req.cookies.authorisation_server_id;
  const codeVerifier = req.cookies.code_verifier;
  const state = req.cookies.state;
  const nonce = req.cookies.nonce;

  if (!authorisationServerId || !codeVerifier || !state || !nonce) {
    console.error('Missing one or more required cookies:', {
      authorisationServerId,
      codeVerifier,
      state,
      nonce
    });
    return res.status(400).json({ error: 'Missing required cookies for token exchange.' });
  }

  try {
    // Retrieve tokens from the authorization server
    const tokenSet = await rpClient.retrieveTokens(
      authorisationServerId,
      { code },
      codeVerifier,
      state,
      nonce
    );

    const claims = tokenSet.claims();
    const decodedToken = jwtDecode(tokenSet.id_token);

    // Check for the over18 claim
    const over18 = decodedToken.over18;
    if (over18) {
      // Generate and store a token if the user is over 18
      const token = generateAndStoreToken(cartId);  
      console.info(`Verification successful for cartId ${cartId}. Token generated: ${token}`);
      
      const userInfo = await rpClient.getUserInfo(authorisationServerId, tokenSet.access_token);
      console.info(`Returned userInfo: ${JSON.stringify(userInfo)}`);

      return res.json({
        claims,
        token,
        userInfo,
        xFapiInteractionId: tokenSet.xFapiInteractionId
      });
    } else {
      // User failed the age verification
      return res.status(400).json({ error: 'User verification failed. Age requirement not met.' });
    }
  } catch (error) {
    // Log error and send the response
    console.error('Error retrieving tokens:', error);
    return res.status(500).json({ error: 'Failed to retrieve tokens', details: error.message });
  }
});

export default router;
