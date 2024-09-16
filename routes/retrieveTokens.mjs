import express from 'express';
import RelyingPartyClientSdk from '@connectid-tools/rp-nodejs-sdk';
import { config } from '../config.js';

const router = express.Router();
const rpClient = new RelyingPartyClientSdk(config);

router.get('/retrieve-tokens', async (req, res) => {
  const cartId = req.query.cartId;
  const code = req.query.code;

  if (!code || !cartId) {
    console.error('Code parameter and cartId are required');
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
      nonce,
    });
    return res.status(400).json({ error: 'Missing required cookies for token exchange.' });
  }

  try {
    // Dynamically import jwt-decode to ensure compatibility with ESM modules
    const { default: jwtDecode } = await import('jwt-decode');

    // Retrieve fallback providers from the relying party client
    const fallbackProviders = await rpClient.getFallbackProviderParticipants();

    // Log fallback providers
    console.info(`Fallback Providers: ${JSON.stringify(fallbackProviders, null, 2)}`);

    // Assuming only one fallback provider is returned, we'll extract it
    const fallbackProvider = fallbackProviders[0] || 'No fallback provider available';

    // Retrieve tokens from the authorization server
    const tokenSet = await rpClient.retrieveTokens(
      authorisationServerId,
      req.query,
      codeVerifier,
      state,
      nonce
    );

    // Extract claims and decode token
    const claims = tokenSet.claims();
    const decodedToken = jwtDecode(tokenSet.id_token);

    // Log information
    console.info(`Returned claims: ${JSON.stringify(claims, null, 2)}`);
    console.info(`Returned raw id_token: ${tokenSet.id_token}`);
    console.info(`Returned decoded id_token: ${JSON.stringify(decodedToken, null, 2)}`);
    console.info(`Returned xFapiInteractionId: ${tokenSet.xFapiInteractionId}`);

    // Check for the over18 claim (optional claim)
    const over18 = decodedToken.over18 || 'Claim not present';

    console.info(`Over18 claim: ${over18}`);

    return res.json({
      claims,
      token: {
        decoded: JSON.stringify(decodedToken, null, 2),
        raw: tokenSet.id_token,
      },
      xFapiInteractionId: tokenSet.xFapiInteractionId,
      over18,  // Include over18 voluntary claim
      fallbackProvider // Include fallback provider in the response
    });
  } catch (error) {
    console.error('Error retrieving token set: ', error);
    return res.status(500).json({ error: 'Failed to retrieve token set', details: error.toString() });
  }
});

export default router;
