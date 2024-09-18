import express from 'express';
import RelyingPartyClientSdk from '@connectid-tools/rp-nodejs-sdk';
import { config } from '../config.js';
import { clearCookies } from '../utils/cookieUtils.mjs';

const router = express.Router();
const rpClient = new RelyingPartyClientSdk(config);

// Import jwtDecode dynamically for ESM compatibility
async function getJwtDecode() {
  const { default: jwtDecode } = await import('jwt-decode');
  return jwtDecode;
}

router.get('/retrieve-tokens', async (req, res) => {
  const { code } = req.query; 

  // Validate that the authorization code is present
  if (!code) {
    clearCookies(res);
    return res.status(400).json({ error: 'Code parameter is required' });
  }

  // Retrieve necessary cookies for token retrieval
  const { authorisation_server_id, code_verifier, state, nonce } = req.cookies;
  
  console.log(`State retrieved from cookies: ${state}`); // Add logging

  if (!authorisation_server_id || !code_verifier || !state || !nonce) {
    return res.status(400).json({ error: 'Missing required cookies for token retrieval' });
  }

  console.info(`Retrieved cookies - authorisation_server_id: ${authorisation_server_id}, state: ${state}, nonce: ${nonce}`);

  try {
    // Call the rpClient's retrieveTokens method to exchange the code for tokens
    const tokenSet = await rpClient.retrieveTokens(
      authorisation_server_id, // Authorization server ID
      { code },                // Contains the authorization code (i.e., code)
      code_verifier,           // Code verifier used in the PKCE flow
      state,                   // State to match the original request
      nonce                    // Nonce to match the original request
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
