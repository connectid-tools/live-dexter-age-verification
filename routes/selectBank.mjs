import express from 'express';
import RelyingPartyClientSdk from '@connectid-tools/rp-nodejs-sdk';
import session from 'express-session';
// import path from 'path'
import { config } from '../config.js';
import { getLogger } from '../utils/logger.mjs'; // Import the logger
const logger = getLogger('info');  // Create a logger instance with the desired log level
import { redisClient } from '../app.mjs'; // Import the shared Redis client


const router = express.Router();
const rpClient = new RelyingPartyClientSdk(config);
// const __dirname = path.dirname(__filename)

const EXPIRATION_TIME = 3600 * 1000; // 1 hour in milliseconds

// Helper to clean up expired cart IDs
async function cleanupExpiredCartIds(sessionId) {
  const redisKey = `session:${sessionId}:cartIds`;
  try {
      const cartIds = JSON.parse(await redisClient.get(redisKey)) || [];
      const filteredCartIds = cartIds.filter(cart => Date.now() - cart.timestamp <= EXPIRATION_TIME);
      await redisClient.set(redisKey, JSON.stringify(filteredCartIds)); // Save cleaned-up cart IDs
  } catch (error) {
      logger.error(`Failed to clean up expired cart IDs: ${error.message}`);
  }
}


// Middleware to load cart IDs from Redis
router.use(async (req, res, next) => {
  if (!req.sessionID) {
      logger.error('Session ID is missing.');
      return res.status(400).json({ error: 'Session ID is required.' });
  }

  const redisKey = `session:${req.sessionID}:cartIds`;
  
  try {

      req.session.cartIds = JSON.parse(await redisClient.get(redisKey)) || [];
  } catch (error) {
      logger.error(`Failed to load cart IDs from Redis: ${error.message}`);
      req.session.cartIds = []; // Fallback to an empty array
  }
  next();
});


// async function cleanupExpiredCartIds(sessionId) {
//   const redisKey = `session:${sessionId}:cartIds`;
//   try {
//       const cartIds = JSON.parse(await redisClient.get(redisKey)) || [];
//       const filteredCartIds = cartIds.filter(cart => {
//           const isExpired = Date.now() - cart.timestamp > EXPIRATION_TIME;
//           if (isExpired) {
//               logger.info(`Cart ID ${cart.cartId} expired and removed.`);
//           }
//           return !isExpired;
//       });
//       await redisClient.set(redisKey, JSON.stringify(filteredCartIds)); // Save cleaned-up cart IDs
//   } catch (error) {
//       logger.error(`Failed to clean up expired cart IDs: ${error.message}`);
//   }
// }

router.post('/', async (req, res) => {
  const essentialClaims = req.body.essentialClaims || [];
  const voluntaryClaims = req.body.voluntaryClaims || [];
  const purpose = req.body.purpose || config.data.purpose;
  const authServerId = req.body.authorisationServerId;
  const cartId = req.body.cartId;

      // Validate required fields
      if (!authServerId) {
        const error = 'authorisationServerId parameter is required';
        logger.error('Error:', error);
        return res.status(400).json({ error });
    }
    if (!cartId) {
        const error = 'cartId parameter is required';
        logger.error('Error:', error);
        return res.status(400).json({ error });
    }


   // Log the state of the session
  



  try {
    
    await cleanupExpiredCartIds(req.sessionID);
    logger.info(`Session cartIds before validation: ${JSON.stringify(req.session.cartIds)}`);


    
    if (!req.session.cartIds || !req.session.cartIds.includes(cartId)) {
      logger.error(
          `Cart ID mismatch: received '${cartId}' is not in the session cartIds [${req.session.cartIds ? req.session.cartIds.join(', ') : 'empty'}]`
      );
      return res.status(400).json({ error: 'Invalid cartId for the current session' });
  }

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

    // Log after setting cookies
    logger.info('--- Cookies have been set ---');
    // Return the auth URL to the client
    return res.json({ authUrl, state, nonce, code_verifier, authorisationServerId: authServerId });
  } catch (error) {
    logger.error('Error during PAR request:', error);
    return res.status(500).json({ error: 'Failed to send PAR request', details: error.message });
  }
});

export default router;
