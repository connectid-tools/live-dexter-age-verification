import express from 'express';
import RelyingPartyClientSdk from '@connectid-tools/rp-nodejs-sdk';
import { config } from '../config.js';
import { getLogger } from '../utils/logger.mjs';  // Adjust the path to your logger file

const router = express.Router();
const rpClient = new RelyingPartyClientSdk(config);
const logger = getLogger('info'); // Initialize the logger

router.post('/select-bank', async (req, res) => {
  const essentialClaims = req.body.essentialClaims || [];
  const voluntaryClaims = req.body.voluntaryClaims || [];
  const purpose = req.body.purpose || config.data.purpose;
  const authServerId = req.body.authorisationServerId;

  logger.info('--- Received request with payload ---', { payload: req.body });

  // Check if the `authorisationServerId` is missing
  if (!authServerId) {
    const error = 'authorisationServerId parameter is required';
    logger.error('Error:', error);
    return res.status(400).json({ error });
  }

  const cartId = req.body.cartId;
  if (!cartId) {
    const error = 'cartId parameter is required';
    logger.error('Error:', error);
    return res.status(400).json({ error });
  }

  try {
    logger.info('--- Sending PAR request to auth server ---', {
      authServerId,
      essentialClaims,
      voluntaryClaims,
      purpose
    });

    // Send the pushed authorization request
    const { authUrl, code_verifier, state, nonce, xFapiInteractionId } = await rpClient.sendPushedAuthorisationRequest(
      authServerId,
      essentialClaims,
      voluntaryClaims,
      purpose
    );

    logger.info('--- PAR request sent successfully ---', {
      authUrl,
      code_verifier,
      state,
      nonce,
      xFapiInteractionId
    });

    // Cookie options
    const cookieOptions = {
      path: '/',
      sameSite: 'None', // Adjust if necessary
      secure: true,
      httpOnly: true,
      maxAge: 3 * 60 * 1000 // 3 minutes
    };

    logger.info('--- Setting cookies ---', { state, nonce, code_verifier, authServerId });

    // Set cookies to maintain state
    res.cookie('state', state, cookieOptions);
    res.cookie('nonce', nonce, cookieOptions);
    res.cookie('code_verifier', code_verifier, cookieOptions);
    res.cookie('authorisation_server_id', authServerId, cookieOptions);

    logger.info('--- Cookies have been set ---', { cookies: res.getHeaders()['set-cookie'] });

    // Return the auth URL to the client
    return res.json({ authUrl });
  } catch (error) {
    logger.error('Error during PAR request:', error); // Log full error object
    return res.status(500).json({ error: 'Failed to send PAR request', details: error.message });
  }
});

export default router;
