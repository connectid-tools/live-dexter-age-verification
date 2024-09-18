import express from 'express';
import RelyingPartyClientSdk from '@connectid-tools/rp-nodejs-sdk';
import { config } from '../config.js';
import { clearCookies } from './cookieUtils.js';

const router = express.Router();
const rpClient = new RelyingPartyClientSdk(config);

// Import jwtDecode dynamically for ESM compatibility
async function getJwtDecode() {
  const { default: jwtDecode } = await import('jwt-decode');
  return jwtDecode;
}

router.get('/retrieve-tokens', async (req, res) => {
  const { code, cartId } = req.query;

  // Validate both `code` and `cartId`
  if (!code || !cartId) {
    clearCookies(res);
    return res.status(400).json({ error: 'Code and cartId parameters are required' });
  }

  // Check if the necessary cookies are set
  const { authorisation_server_id, code_verifier, state, nonce } = req.cookies;
  if (!authorisation_server_id || !code_verifier || !state || !nonce) {
    return res.status(400).json({ error: 'Missing required cookies for token retrieval' });
  }

  try {
    // Retrieve tokens from the authorization server
    const tokenSet = await rpClient.retrieveTokens(
      authorisation_server_id,
      req.query, // contains the authorization code (i.e., code)
      code_verifier,
      state,
      nonce
    );

    // Extract the claims and tokens
    const claims = tokenSet.claims();
    const jwtDecode = await getJwtDecode();
    const token = {
      decoded: JSON.stringify(jwtDecode(tokenSet.id_token), null, 2),
      raw: tokenSet.id_token,
    };

    console.info(`Returned claims: ${JSON.stringify(claims, null, 2)}`);
    console.info(`Returned raw id_token: ${token.raw}`);
    console.info(`Returned decoded id_token: ${token.decoded}`);
    console.info(`Returned xFapiInteractionId: ${tokenSet.xFapiInteractionId}`);

    // Return the claims and token info as a response
    return res.json({ claims, token, xFapiInteractionId: tokenSet.xFapiInteractionId });
  } catch (error) {
    console.error('Error retrieving tokenset: ' + error);
    return res.status(500).json({ error: error.toString() });
  }
});

export default router;
