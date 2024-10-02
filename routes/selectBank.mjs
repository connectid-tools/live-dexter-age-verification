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
    logger.info(
      `Processing request to send PAR with authorisationServerId='${authServerId}' essentialClaims='${essentialClaims.join(
        ','
      )}' voluntaryClaims='${voluntaryClaims.join(',')}', purpose='${purpose}'`
    )
    // logger.info('--- Sending PAR request to auth server ---');
    // logger.info(`- Authorisation Server ID: ${authServerId}`);
    // logger.info(`- Essential Claims: ${JSON.stringify(essentialClaims)}`);
    // logger.info(`- Voluntary Claims: ${JSON.stringify(voluntaryClaims)}`);
    // logger.info(`- Purpose: ${purpose}`);

    // Send the pushed authorization request
    const { authUrl, code_verifier, state, nonce, xFapiInteractionId } = await rpClient.sendPushedAuthorisationRequest(
      authServerId,
      essentialClaims,
      voluntaryClaims,
      purpose
    );

// // Relaxed cookie options for testing
//  const cookieOptions = {
//   path: '/',  // Ensure this is root
//   sameSite: 'None',
//   secure: true,
//   httpOnly: true,
//   maxAge: 10 * 60 * 1000
// };


    // Log the cookies before setting
    logger.info('--- Setting cookies ---');
    logger.info(`- Setting state: ${state}`);
    logger.info(`- Setting nonce: ${nonce}`);
    logger.info(`- Setting code_verifier: ${code_verifier}`);
    logger.info(`- Setting authorisation_server_id: ${authServerId}`);


    // const cookieOptions = {
    //   path: '/',  // Ensure the cookie is sent for the entire domain
    //   sameSite: 'None',
    //   // secure: true,
    //   httpOnly: true,
    //   maxAge: 10 * 60 * 1000  // Optional: Expire cookies after 10 minutes
    // };

    // Set cookies to maintain state
    res.cookie('state', state, { path: '/', sameSite: 'None', secure: true });
    res.cookie('nonce', nonce, { path: '/', sameSite: 'None', secure: true });
    res.cookie('code_verifier', code_verifier, { path: '/', sameSite: 'None', secure: true });
    res.cookie('authorisation_server_id', authServerId, { path: '/', sameSite: 'None', secure: true });
    

    // logger.info(
    //   `PAR sent to authorisationServerId='${authServerId}', returning url='${authUrl}', x-fapi-interaction-id='${xFapiInteractionId}'`
    // )

    // Log after setting cookies
    logger.info('--- Cookies have been set ---');
    // Return the auth URL to the client
    return res.json({ authUrl });
  } catch (error) {
    logger.error('Error during PAR request:', error);
    return res.status(500).json({ error: 'Failed to send PAR request', details: error.message });
  }
});

export default router;
