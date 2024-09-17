import express from 'express';
import RelyingPartyClientSdk from '@connectid-tools/rp-nodejs-sdk';
import { config } from '../config.js';

const router = express.Router();
const rpClient = new RelyingPartyClientSdk(config);
router.get('/retrieve-ttokens', async (req, res) => {
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

    // Retrieve tokens from the authorization server
    const tokenSet = await rpClient.retrieveTokens(
      authorisationServerId,
      req.query,
      codeVerifier,
      state,
      nonce
    );

    // Extract standard claims
    const claims = tokenSet.claims();

    // Extract extended claims (consolidated claims)
    const consolidatedClaims = tokenSet.consolidatedClaims();

    // Decode the id_token
    const decodedToken = jwtDecode(tokenSet.id_token);

    // Validate required OpenID Connect ID Token claims
    const requiredClaims = ['iss', 'sub', 'aud', 'exp', 'iat'];
    for (const claim of requiredClaims) {
      if (!decodedToken[claim]) {
        console.error(`Missing required claim: ${claim}`);
        return res.status(400).json({ error: `Missing required claim: ${claim}` });
      }
    }

    // Retrieve transaction ID (txn) claim
    const txn = claims.txn || 'Transaction ID not present'; // Check for the transaction ID
    console.info(`Transaction ID: ${txn}`);

    // Log information
    console.info(`Returned standard claims: ${JSON.stringify(claims, null, 2)}`);
    console.info(`Returned consolidated claims: ${JSON.stringify(consolidatedClaims, null, 2)}`);
    console.info(`Returned raw id_token: ${tokenSet.id_token}`);
    console.info(`Returned decoded id_token: ${JSON.stringify(decodedToken, null, 2)}`);
    console.info(`Returned xFapiInteractionId: ${tokenSet.xFapiInteractionId}`);

    // Check for the over18 claim (optional claim)
    const over18 = consolidatedClaims.over18 || 'Claim not present';

    console.info(`Over18 claim: ${over18}`);

    return res.json({
      txn,  // Return the transaction ID
      claims,
      consolidatedClaims, // Return both standard and extended claims
      token: {
        decoded: JSON.stringify(decodedToken, null, 2),
        raw: tokenSet.id_token,
      },
      xFapiInteractionId: tokenSet.xFapiInteractionId,
      over18,  // Include over18 voluntary claim
      txn      // Return the transaction ID
    });
  } catch (error) {
    console.error('Error retrieving token set: ', error);
    return res.status(500).json({ error: 'Failed to retrieve token set', details: error.toString() });
  }
});


export default router;