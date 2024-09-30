import express from 'express';
import RelyingPartyClientSdk from '@connectid-tools/rp-nodejs-sdk';
import { config } from '../config.js';
import { getLogger } from '../utils/logger.mjs'; // Import the logger
const logger = getLogger('info');  // Create a logger instance with the desired log level

const router = express.Router();
const rpClient = new RelyingPartyClientSdk(config);

router.post('/', async (req, res) => {
  const essentialClaims = req.body.essentialClaims || [];
  const voluntaryClaims = req.body.voluntaryClaims || [];
  const purpose = req.body.purpose || config.data.purpose;
  const authServerId = req.body.authorisationServerId;

  logger.info('--- Received request with payload ---');
  logger.info('Payload:', JSON.stringify(req.body, null, 2)); // Log the incoming request payload

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
    logger.info('--- Sending PAR request to auth server ---');
    logger.info(`- Authorisation Server ID: ${authServerId}`);
    logger.info(`- Essential Claims: ${JSON.stringify(essentialClaims)}`);
    logger.info(`- Voluntary Claims: ${JSON.stringify(voluntaryClaims)}`);
    logger.info(`- Purpose: ${purpose}`);

    // Send the pushed authorization request
    const { authUrl, code_verifier, state, nonce, xFapiInteractionId } = await rpClient.sendPushedAuthorisationRequest(
      authServerId,
      essentialClaims,
      voluntaryClaims,
      purpose
    );

    logger.info('--- PAR request sent successfully ---');
    logger.info(`- Auth URL: ${authUrl}`);
    logger.info(`- Code Verifier: ${code_verifier}`);
    logger.info(`- State: ${state}`);
    logger.info(`- Nonce: ${nonce}`);
    logger.info(`- xFapiInteractionId: ${xFapiInteractionId}`);

    // Cookie options
    const cookieOptions = {
      path: '/',
      sameSite: 'None',  // Allows cross-site cookies
      secure: true,      // Ensure secure transmission
      httpOnly: true,    // Prevent JavaScript access to cookies (if necessary)
      maxAge: 3 * 60 * 1000 // 3 minutes
    };

    // Log the cookies before setting
    logger.info('--- Setting cookies ---');
    logger.info(`- Setting state: ${state}`);
    logger.info(`- Setting nonce: ${nonce}`);
    logger.info(`- Setting code_verifier: ${code_verifier}`);
    logger.info(`- Setting authorisation_server_id: ${authServerId}`);

    // Set cookies to maintain state
    res.cookie('state', state, cookieOptions);
    res.cookie('nonce', nonce, cookieOptions);
    res.cookie('code_verifier', code_verifier, cookieOptions);
    res.cookie('authorisation_server_id', authServerId, cookieOptions);

    // Log after setting cookies
    logger.info('--- Cookies have been set ---');
    logger.info('Cookies set for the response:', res.getHeaders()['set-cookie']); // Output the cookies being set

    // Return the auth URL to the client
    return res.json({ authUrl });
  } catch (error) {
    logger.error('Error during PAR request:', error);
    return res.status(500).json({ error: 'Failed to send PAR request', details: error.message });
  }
});

export default router;
