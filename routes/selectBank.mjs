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

  // logger.log('--- Received request with payload ---');
  // logger.log('Payload:', JSON.stringify(req.body, null, 2)); // Log the incoming request payload

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
    // logger.log('--- Sending PAR request to auth server ---');
    // logger.log(`- Authorisation Server ID: ${authServerId}`);
    // logger.log(`- Essential Claims: ${JSON.stringify(essentialClaims)}`);
    // logger.log(`- Voluntary Claims: ${JSON.stringify(voluntaryClaims)}`);
    // logger.log(`- Purpose: ${purpose}`);

    // Send the pushed authorization request
    const { authUrl, code_verifier, state, nonce, xFapiInteractionId } = await rpClient.sendPushedAuthorisationRequest(
      authServerId,
      essentialClaims,
      voluntaryClaims,
      purpose
    );

    // logger.log('--- PAR request sent successfully ---');
    // logger.log(`- Auth URL: ${authUrl}`);
    // logger.log(`- Code Verifier: ${code_verifier}`);
    // logger.log(`- State: ${state}`);
    // logger.log(`- Nonce: ${nonce}`);
    // logger.log(`- xFapiInteractionId: ${xFapiInteractionId}`);

    // Cookie options
    const cookieOptions = {
      path: '/',
      sameSite: 'None',
      secure: true,
      httpOnly: true,
      maxAge: 3 * 60 * 1000 // 3 minutes
    };

    // Log the cookies before setting
    // logger.log('--- Setting cookies ---');
    // logger.log(`- Setting state: ${state}`);
    // logger.log(`- Setting nonce: ${nonce}`);
    // logger.log(`- Setting code_verifier: ${code_verifier}`);
    // logger.log(`- Setting authorisation_server_id: ${authServerId}`);

    // Set cookies to maintain state
    res.cookie('state', state, cookieOptions);
    res.cookie('nonce', nonce, cookieOptions);
    res.cookie('code_verifier', code_verifier, cookieOptions);
    res.cookie('authorisation_server_id', authServerId, cookieOptions);

    // Log after setting cookies
    // logger.log('--- Cookies have been set ---');
    // logger.log('Cookies set for the response:', res.getHeaders()['set-cookie']); // Output the cookies being set

    // Return the auth URL to the client
    return res.json({ authUrl });
  } catch (error) {
    logger.error('Error during PAR request:', error);
    return res.status(500).json({ error: 'Failed to send PAR request', details: error.message });
  }
});

export default router;
