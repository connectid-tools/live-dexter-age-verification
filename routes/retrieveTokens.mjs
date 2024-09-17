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

    console.info(`standard claims: ${claims}`);


    // Extract extended claims (consolidated claims)
    const consolidatedClaims = tokenSet.consolidatedClaims();


        // Retrieve transaction ID (txn) from either standard or consolidated claims
        const txn = claims.txn || consolidatedClaims.txn || 'Transaction ID not present';
        console.info(`Transaction ID: ${txn}`);

        
    
    console.info(`standard claims: ${consolidatedClaims}`);

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

    console.info(`Transaction ID: ${txn}`);


    return res.json({
      txn,  // Return the transaction ID
      claims,
      consolidatedClaims, // Return both standard and extended claims
      token: {
        decoded: JSON.stringify(jwtDecode(tokenSet.id_token), null, 2),
        raw: tokenSet.id_token,
      },
      xFapiInteractionId: tokenSet.xFapiInteractionId,
    });
  } catch (error) {
    console.error('Error retrieving token set: ', error);
    return res.status(500).json({ error: 'Failed to retrieve token set', details: error.toString() });
  }
});


export default router;