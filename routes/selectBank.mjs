import express from 'express';
import RelyingPartyClientSdk from '@connectid-tools/rp-nodejs-sdk';
import { config } from '../config.js';
import { getLogger } from '../utils/logger.mjs';
import { redisClient } from '../app.mjs'; // Import Redis client
import jwt from 'jsonwebtoken';

const logger = getLogger('info');
const router = express.Router();
const rpClient = new RelyingPartyClientSdk(config);

const JWT_SECRET = process.env.JWT_SECRET || 'your-very-secret-key';
const EXPIRATION_TIME = 3600 * 1000; // 1 hour

// Helper function to clean up expired cart IDs in Redis
async function cleanupExpiredCartIds() {
    try {
        const keys = await redisClient.keys('cartId:*'); // Fetch all keys related to cart IDs
        for (const key of keys) {
            const cartData = JSON.parse(await redisClient.get(key));
            if (Date.now() - cartData.timestamp > EXPIRATION_TIME) {
                await redisClient.del(key); // Delete expired cart ID
                logger.info(`Expired cart ID removed: ${key}`);
            }
        }
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
    const token = req.headers.authorization?.split(' ')[1]; // Extract token from Authorization header
    if (!token) {
        logger.error('[POST /select-bank] Missing Authorization token.');
        return res.status(401).json({ error: 'Authorization token is required.' });
    }

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
        const decoded = jwt.verify(token, JWT_SECRET); // Verify the JWT
        const { cartId } = decoded;

        // Clean up expired cart IDs
        await cleanupExpiredCartIds();

        // Validate that the cart ID exists in Redis
        const redisKey = `cartId:${cartId}`;
        const cartData = await redisClient.get(redisKey);
        if (!cartData) {
            logger.error(`[POST /select-bank] Cart ID ${cartId} not found or expired.`);
            return res.status(400).json({ error: 'Invalid or expired cart ID.' });
        }

        logger.info(`[POST /select-bank] Cart ID ${cartId} is valid. Proceeding with authorization.`);
        
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
