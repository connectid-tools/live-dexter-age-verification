import express from 'express';
import RelyingPartyClientSdk from '@connectid-tools/rp-nodejs-sdk';
import { config } from '../config.js';
import { getLogger } from '../utils/logger.mjs';
import { redisClient } from '../app.mjs'; // Import Redis client

const logger = getLogger('info');
const router = express.Router();
const rpClient = new RelyingPartyClientSdk(config);

const EXPIRATION_TIME = 3600 * 1000; // 1 hour

// Helper function to clean up expired cart IDs in Redis
async function cleanupExpiredCartIds(sessionId) {
    const redisKey = `session:${sessionId}:cartIds`;
    try {
        const cartIds = JSON.parse(await redisClient.get(redisKey)) || [];
        const filteredCartIds = cartIds.filter(cart => Date.now() - cart.timestamp <= EXPIRATION_TIME);

        // Update Redis with only valid cart IDs
        await redisClient
            .multi()
            .set(redisKey, JSON.stringify(filteredCartIds))
            .expire(redisKey, EXPIRATION_TIME / 1000)
            .exec();

        logger.info(`Cleaned up expired cart IDs for session ${sessionId}: ${JSON.stringify(filteredCartIds)}`);
    } catch (error) {
        logger.error(`Failed to clean up expired cart IDs: ${error.message}`);
    }
}

router.use(async (req, res, next) => {
    logger.info(`[Middleware] Session ID: ${req.sessionID}`);

    if (!req.sessionID) {
        logger.error('[Middleware] Session ID is missing.');
        return res.status(400).json({ error: 'Session ID is required.' });
    }

    try {
        const redisKey = `session:${req.sessionID}:cartIds`;
        const cartIds = JSON.parse(await redisClient.get(redisKey)) || [];
        logger.info(`[Middleware] Loaded cart IDs from Redis: ${JSON.stringify(cartIds)}`);
        req.session.cartIds = cartIds;
    } catch (error) {
        logger.error(`[Middleware] Failed to load cart IDs from Redis: ${error.message}`);
        req.session.cartIds = [];
    }
    next();
});

// `/select-bank` route handler
router.post('/', async (req, res) => {
    const requestId = Date.now();
    const essentialClaims = req.body.essentialClaims || [];
    const voluntaryClaims = req.body.voluntaryClaims || [];
    const purpose = req.body.purpose || config.data.purpose;
    const authServerId = req.body.authorisationServerId;
    const cartId = req.body.cartId;

    // Validate required fields
    if (!authServerId) {
        logger.error(`[Request ${requestId}] Missing 'authorisationServerId'.`);
        return res.status(400).json({ error: 'authorisationServerId parameter is required' });
    }
    if (!cartId) {
        logger.error(`[Request ${requestId}] Missing 'cartId'.`);
        return res.status(400).json({ error: 'cartId parameter is required' });
    }

    try {
        // Clean up expired cart IDs
        await cleanupExpiredCartIds(req.sessionID);

        // Verify the cart ID is valid in the current session
        if (!req.session.cartIds.includes(cartId)) {
            const redisKey = `session:${req.sessionID}:cartIds`;
            req.session.cartIds = JSON.parse(await redisClient.get(redisKey)) || [];
            logger.info(`Re-fetched cart IDs from Redis: ${JSON.stringify(req.session.cartIds)}`);

            if (!req.session.cartIds.includes(cartId)) {
                logger.error(`[Request ${requestId}] Cart ID mismatch: '${cartId}' not found in session.`);
                return res.status(400).json({ error: 'Invalid cartId for the current session' });
            }
        }

        // Send the pushed authorization request
        const { authUrl, code_verifier, state, nonce, xFapiInteractionId } =
            await rpClient.sendPushedAuthorisationRequest(
                authServerId,
                essentialClaims,
                voluntaryClaims,
                purpose
            );

        // Set cookies for state management
        res.cookie('state', state, { secure: true, sameSite: 'None', httpOnly: true });
        res.cookie('nonce', nonce, { secure: true, sameSite: 'None', httpOnly: true });
        res.cookie('code_verifier', code_verifier, { secure: true, sameSite: 'None', httpOnly: true });

        logger.info(`[Request ${requestId}] PAR request successful. Returning authorization URL.`);
        return res.json({ authUrl });
    } catch (error) {
        logger.error(`[Request ${requestId}] Error during PAR request: ${error.stack || error.message}`);
        return res.status(500).json({ error: 'Internal server error', details: error.message });
    }
});

export default router;
