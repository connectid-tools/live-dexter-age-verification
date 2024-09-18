import express from 'express';
import RelyingPartyClientSdk from '@connectid-tools/rp-nodejs-sdk';
import { config } from '../config.js';
import { clearCookies } from '../utils/cookieUtils.mjs';
import { jwtDecode } from 'jwt-decode'

const router = express.Router();
const rpClient = new RelyingPartyClientSdk(config);

// Import jwtDecode dynamically for ESM compatibility
// async function getJwtDecode() {
//   const { default: jwtDecode } = await import('jwt-decode');
//   return jwtDecode;
// }

router.get('/retrieve-tokens', async (req, res) => {
  console.log('--- /retrieve-tokens endpoint hit ---');

  // Extract the authorization code from query params
  const { code } = req.query;
  console.log(`Received code: ${code}`);

  // Validate that the authorization code is present
  if (!code) {
    console.error('Code parameter is missing');
    return res.status(400).json({ error: 'Code parameter is required' });
  }

  // Retrieve necessary cookies for token retrieval
  const { authorisation_server_id, code_verifier, state, nonce } = req.cookies;
  console.log('Cookies received:');
  console.log(`authorisation_server_id: ${authorisation_server_id}`);
  console.log(`code_verifier: ${code_verifier}`);
  console.log(`state: ${state}`);
  console.log(`nonce: ${nonce}`);

  // Check if any required cookie is missing
  if (!authorisation_server_id || !code_verifier || !state || !nonce) {
    console.error('Missing required cookies for token retrieval');
    return res.status(400).json({ error: 'Missing required cookies for token retrieval' });
  }

  try {
    console.log('Attempting to retrieve tokens with the following details:');
    console.log(`authorisation_server_id: ${authorisation_server_id}`);
    console.log(`code_verifier: ${code_verifier}`);
    console.log(`state: ${state}`);
    console.log(`nonce: ${nonce}`);

    // Call the rpClient's retrieveTokens method to exchange the code for tokens
    const tokenSet = await rpClient.retrieveTokens(
      authorisation_server_id, // Authorization server ID
      req.query,                // Contains the authorization code (i.e., code)
      code_verifier,           // Code verifier used in the PKCE flow
      state,                   // State to match the original request
      nonce                    // Nonce to match the original request
    );

    console.log('Tokens successfully retrieved');
    console.log('Full Token Set:', JSON.stringify(tokenSet, null, 2));

    // Check if the state is missing in the response
    if (!tokenSet.state) {
      console.error('State is missing in the tokenSet response');
    }

    // Extract the claims and tokens
    const claims = tokenSet.claims();
    // const jwtDecode = await getJwtDecode();
    const token = {
      decoded: JSON.stringify(jwtDecode(tokenSet.id_token), null, 2),
      raw: tokenSet.id_token,
    };

    console.info(`Returned claims: ${JSON.stringify(claims, null, 2)}`);
    console.info(`Returned raw id_token: ${token.raw}`);
    console.info(`Returned decoded id_token: ${token.decoded}`);
    console.info(`Returned xFapiInteractionId: ${tokenSet.xFapiInteractionId}`);

    console.log('Claims:', claims);
    console.log('ID Token (raw):', token.raw);
    console.log('ID Token (decoded):', token.decoded);

    // Clear cookies AFTER ensuring the tokens have been retrieved and no further actions need cookies
    clearCookies(res);
    console.log('Cookies cleared successfully');

    // Return the claims and token info as a response
    console.log('Returning token and claims info in the response');
    return res.json({ claims, token, xFapiInteractionId: tokenSet.xFapiInteractionId });
  } catch (error) {
    console.error('Error retrieving tokenset:', error);
    return res.status(500).json({ error: error.toString() });
  }
});

export default router;
