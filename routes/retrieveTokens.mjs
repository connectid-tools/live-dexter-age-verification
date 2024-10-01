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

  // Log incoming request payload and headers
  logger.info('--- Received request with payload ---');
  logger.info('Payload:', JSON.stringify(req.body, null, 2));  // Log the incoming request payload
  logger.info('Request headers:', JSON.stringify(req.headers, null, 2));  // Log request headers for debugging

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

    // Relaxed cookie options for testing
    const cookieOptions = {
      path: '/',  // Ensure this is root
      sameSite: 'None',
      secure: true,
      httpOnly: true,
      maxAge: 10 * 60 * 1000  // 10 minutes
    };

    // Log the cookies before setting them
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

    // Log after setting cookies to verify they were correctly set
    logger.info('--- Cookies have been set ---');
    logger.info('Cookies set for the response:', res.getHeaders()['set-cookie']);  // Output the cookies being set

    // Log before clearing cookies
    logger.info('--- Clearing cookies ---');

    // Clear cookies AFTER ensuring the tokens have been retrieved and no further actions need cookies
    clearCookies(res);  // Assuming clearCookies is a function you've defined elsewhere

    // Log after clearing cookies
    logger.info('Cookies cleared successfully');

    // Return the auth URL to the client
    return res.json({ authUrl });
  } catch (error) {
    // Log the error message and stack trace for debugging
    logger.error('Error during PAR request:', error.message);
    logger.error('Error stack:', error.stack);
    return res.status(500).json({ error: 'Failed to send PAR request', details: error.message });
  }
});

export default router;
