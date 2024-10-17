import express from 'express';
import RelyingPartyClientSdk from '@connectid-tools/rp-nodejs-sdk';
// import path from 'path'
import { config } from '../config.js';
import { getLogger } from '../utils/logger.mjs'; // Import the logger
const logger = getLogger('info');  // Create a logger instance with the desired log level

const router = express.Router();
const rpClient = new RelyingPartyClientSdk(config);
// const __dirname = path.dirname(__filename)


router.post('/', async (req, res) => {
  const essentialClaims = req.body.essentialClaims || [];
  const voluntaryClaims = req.body.voluntaryClaims || [];
  const purpose = req.body.purpose || config.data.purpose;
  const authServerId = req.body.authorisationServerId;

  // logger.info('--- Received request with payload ---');
  // logger.info('Payload:', JSON.stringify(req.body, null, 2)); // Log the incoming request payload

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
  logger.info( `Processing request to send PAR with authorisationServerId='${authServerId}' essentialClaims='${essentialClaims.join( ',' )}' voluntaryClaims='${voluntaryClaims.join(',')}', purpose='${purpose}'` );

  // Get fallback participants
  const fallbackParticipants = await rpClient.getFallbackProviderParticipants();

  // Send the pushed authorization request
  const { authUrl, code_verifier, state, nonce, xFapiInteractionId } = await rpClient.sendPushedAuthorisationRequest(
    authServerId,
    essentialClaims,
    voluntaryClaims,
    purpose
  );

  // Set cookies to maintain state
  res.cookie('state', state, { path: '/', sameSite: 'none', secure: true, maxAge: 5 * 60 * 1000 });
  res.cookie('nonce', nonce, { path: '/', sameSite: 'none', secure: true, maxAge: 5 * 60 * 1000 });
  res.cookie('code_verifier', code_verifier, { path: '/', sameSite: 'none', secure: true, maxAge: 5 * 60 * 1000 });
  res.cookie('authorisation_server_id', authServerId, { path: '/', sameSite: 'none', secure: true, maxAge: 5 * 60 * 1000 });

  // Return the auth URL and fallback participants to the client
  return res.json({ authUrl, state, nonce, code_verifier, authorisationServerId: authServerId, fallbackParticipants });
} catch (error) {
  logger.error('Error during PAR request:', error);
  return res.status(500).json({ error: 'Failed to send PAR request', details: error.message });
}

});

export default router;
