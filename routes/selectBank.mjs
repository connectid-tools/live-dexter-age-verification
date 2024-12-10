import express from 'express';
import RelyingPartyClientSdk from '@connectid-tools/rp-nodejs-sdk';
import { config } from '../config.js';
import { getLogger } from '../utils/logger.mjs'; // Import the logger
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

router.post('/', async (req, res) => {
    const requestId = Date.now(); // Unique request identifier

    const essentialClaims = req.body.essentialClaims || [];
    const voluntaryClaims = req.body.voluntaryClaims || [];
    const purpose = req.body.purpose || config.data.purpose;
    const authServerId = req.body.authorisationServerId;
    const cartId = req.signedCookies.cartId;

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


    try {

      await cleanupExpiredCartIds(req.sessionID);
      logger.info(`Session cartIds before validation: ${JSON.stringify(req.session.cartIds)}`);

      if (!req.session.cartIds || !req.session.cartIds.includes(cartId)) {
        logger.error(
            `Cart ID mismatch: received '${cartId}' is not in the session cartIds [${req.session.cartIds ? req.session.cartIds.join(', ') : 'empty'}]`
        );
        return res.status(400).json({ error: 'Invalid cartId for the current session' });
    }
      
        logger.info(`[Request ${requestId}] Processing PAR request with the following details:`);
        logger.info(`- authorisationServerId: ${authServerId}`);
        logger.info(`- essentialClaims: ${JSON.stringify(essentialClaims)}`);
        logger.info(`- voluntaryClaims: ${JSON.stringify(voluntaryClaims)}`);
        logger.info(`- purpose: ${purpose}`);

        // Send the pushed authorization request
        const {
            authUrl,
            code_verifier,
            state,
            nonce,
            xFapiInteractionId,
        } = await rpClient.sendPushedAuthorisationRequest(
            authServerId,
            essentialClaims,
            voluntaryClaims,
            purpose
        );

        logger.info(`[Request ${requestId}] PAR request successful. Received response:`);
        logger.info(`- authUrl: ${authUrl}`);
        logger.info(`- state: ${state}`);
        logger.info(`- nonce: ${nonce}`);
        logger.info(`- code_verifier: ${code_verifier}`);
        logger.info(`- xFapiInteractionId: ${xFapiInteractionId}`);

        // Set cookies to maintain state
        res.cookie('state', state, { path: '/', sameSite: 'none', secure: true, httpOnly: true, maxAge: 5 * 60 * 1000 }); // 5 minutes
        res.cookie('nonce', nonce, { path: '/', sameSite: 'none', secure: true, httpOnly: true, maxAge: 5 * 60 * 1000 });
        res.cookie('code_verifier', code_verifier, { path: '/', sameSite: 'none', secure: true, httpOnly: true, maxAge: 5 * 60 * 1000 });
        res.cookie('authorisation_server_id', authServerId, { path: '/', sameSite: 'none', secure: true, httpOnly: true, maxAge: 5 * 60 * 1000 });

        logger.info(`[Request ${requestId}] Cookies successfully set for state management.`);

        // Return the authorization URL
        return res.json({ authUrl, state, nonce, code_verifier, authorisationServerId: authServerId });
    } catch (error) {
        logger.error(`[Request ${requestId}] Error during PAR request: ${error.stack || error.message}`);
        return res.status(500).json({ error: 'Failed to send PAR request', details: error.message });
    }
});

export default router;
