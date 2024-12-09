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

  logger.info(`Incoming Headers: ${JSON.stringify(req.headers)}`);

  const essentialClaims = req.body.essentialClaims || [];
  const voluntaryClaims = req.body.voluntaryClaims || [];
  const purpose = req.body.purpose || config.data.purpose;
  const authServerId = req.body.authorisationServerId;

  const requestId = Date.now(); // Unique request identifier
  logger.info(`[Request ${requestId}] Incoming Headers: ${JSON.stringify(req.headers)}`);
  logger.info(`[Request ${requestId}] Incoming Cookies: ${JSON.stringify(req.cookies)}`);
  logger.info(`[Request ${requestId}] Incoming Session Before: ${JSON.stringify(req.session)}`);


  // Check if the `authorisationServerId` is missing
  if (!authServerId) {
    logger.error(`[Request ${requestId}] Error: authorisationServerId parameter is required`);
      return res.status(400).json({ error: 'authorisationServerId parameter is required' });
  }

    // Validate session cartId existence
    if (!req.session.cartId) {
      logger.error(`[Request ${requestId}] Error: No cartId found in session`);
      return res.status(400).json({ error: 'No cartId associated with this session' });
  }

  const cartId = req.body.cartId;
  if (!cartId) {
    logger.error(`[Request ${requestId}] Error: cartId parameter is required`);
    return res.status(400).json({ error: 'cartId parameter is required' });
}

if (req.session.cartId !== cartId) {
  logger.error(`[Request ${requestId}] Error: Cart ID mismatch. Received '${cartId}' does not match session cartId '${req.session.cartId}'`);
  return res.status(400).json({ error: 'Invalid cartId for the current session' });
}

    // Log success when cartId matches
    logger.info(
      `[Request ${requestId}] Session Validation Successful received '${cartId}' matches session cartId '${req.session.cartId}'`
    );


  try {
    logger.info(`[Request ${requestId}] Processing PAR request for authorisationServerId='${authorisationServerId}'`);
     logger.info( `Processing request to send PAR with authorisationServerId='${authServerId}' essentialClaims='${essentialClaims.join( ',' )}' voluntaryClaims='${voluntaryClaims.join(',')}', purpose='${purpose}'` )
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
// Set cookies with a 5-minute expiration (300,000 milliseconds)
    res.cookie('state', state, { path: '/', sameSite: 'none', secure: true, maxAge: 5 * 60 * 1000});  // 5 minutes
    res.cookie('nonce', nonce, { path: '/', sameSite: 'none', secure: true, maxAge: 5 * 60 * 1000});
    res.cookie('code_verifier', code_verifier, { path: '/', sameSite: 'none', secure: true, maxAge: 5 * 60 * 1000});
    res.cookie('authorisation_server_id', authServerId, { path: '/', sameSite: 'none', secure: true, maxAge: 5 * 60 * 1000});


    logger.info( `PAR sent to authorisationServerId='${authServerId}', returning url='${authUrl}', x-fapi-interaction-id='${xFapiInteractionId}'`)
    logger.info(`[Request ${requestId}] PAR Request Successful. Redirecting to: ${authUrl}`);
    // Log after setting cookies
    logger.info('--- Cookies have been set ---');
    // Return the auth URL to the client
    return res.json({ authUrl, state, nonce, code_verifier, authorisationServerId: authServerId });
  } catch (error) {
    logger.error('Error during PAR request:', error);
    logger.error(`[Request ${requestId}] Error during PAR request: ${error.stack || error.message}`);
    return res.status(500).json({ error: 'Failed to send PAR request', details: error.message });
  }
});

export default router;
