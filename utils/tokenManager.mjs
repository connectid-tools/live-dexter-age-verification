import express from 'express';
import RelyingPartyClientSdk from '@connectid-tools/rp-nodejs-sdk';
import jwtDecode from 'jwt-decode';
import { config } from '../config.js';
import logger from '../logger.js'; // Assuming you have a logger module

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
    const tokenSet = await rpClient.retrieveTokens(
      authorisationServerId,
      req.query,
      codeVerifier,
      state,
      nonce
    );
    const claims = tokenSet.claims();
    const decodedToken = jwtDecode(tokenSet.id_token);
    const token = {
      decoded: JSON.stringify(decodedToken, null, 2),
      raw: tokenSet.id_token,
    };

    // Check for the over18 claim
    const over18 = decodedToken.over18;
    if (over18 !== undefined) {
      logger.info(`Over18 claim is present: ${over18}`);
    } else {
      logger.info('Over18 claim is not present.');
    }

    logger.info(`Returned claims: ${JSON.stringify(claims, null, 2)}`);
    logger.info(`Returned raw id_token: ${token.raw}`);
    logger.info(`Returned decoded id_token: ${token.decoded}`);
    logger.info(`Returned xFapiInteractionId: ${tokenSet.xFapiInteractionId}`);

    return res.json({ claims, token, xFapiInteractionId: tokenSet.xFapiInteractionId, over18 });
  } catch (error) {
    logger.error('Error retrieving tokenset: ' + error);
    return res.status(500).json({ error: error.toString() });
  }
});

export default router;