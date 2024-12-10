import express from 'express';
import fetch from 'node-fetch';
import { getLogger } from '../utils/logger.mjs';
import { redisClient } from '../app.mjs'; // Import the shared Redis client

const logger = getLogger('info');
const router = express.Router();

const BIGCOMMERCE_API_URL = 'https://api.bigcommerce.com/stores/pmsgmprrgp/v3';
const ACCESS_TOKEN = process.env.ACCESS_TOKEN; // BigCommerce API token
const EXPIRATION_TIME = 3600 * 1000; // 1 hour in milliseconds

// Helper function to validate and store a CartID
async function validateAndStoreCartId(sessionId, cartId) {
    const redisKey = `session:${sessionId}:cartIds`;
    logger.info(`[validateAndStoreCartId] Redis Key: ${redisKey}`);
    logger.info(`[validateAndStoreCartId] Cart ID: ${cartId}`);

    try {
        // Fetch existing cart IDs and filter expired ones
        const cartIds = JSON.parse(await redisClient.get(redisKey)) || [];
        logger.info(`[validateAndStoreCartId] Existing cart IDs in Redis: ${JSON.stringify(cartIds)}`);

        const filteredCartIds = cartIds.filter(cart => Date.now() - cart.timestamp <= EXPIRATION_TIME);
        logger.info(`[validateAndStoreCartId] Filtered cart IDs (non-expired): ${JSON.stringify(filteredCartIds)}`);

        // Validate new CartID using BigCommerce API
        const response = await fetch(`${BIGCOMMERCE_API_URL}/carts/${cartId}`, {
            method: 'GET',
            headers: {
                'X-Auth-Token': ACCESS_TOKEN,
                'Content-Type': 'application/json',
            },
        });

        if (!response.ok) {
            const errorText = `BigCommerce API error: ${response.statusText}`;
            logger.error(`[validateAndStoreCartId] ${errorText}`);
            throw new Error(errorText);
        }

        logger.info(`[validateAndStoreCartId] BigCommerce validation successful for Cart ID: ${cartId}`);

        // Add validated CartID
        filteredCartIds.push({ cartId, timestamp: Date.now() });

        // Atomically update Redis
        await redisClient
            .multi()
            .set(redisKey, JSON.stringify(filteredCartIds))
            .expire(redisKey, EXPIRATION_TIME / 1000)
            .exec();

        logger.info(`[validateAndStoreCartId] Stored validated Cart ID: ${cartId} in Redis.`);
        return filteredCartIds;
    } catch (error) {
        logger.error(`[validateAndStoreCartId] Failed to validate/store Cart ID: ${error.message}`);
        throw new Error(error.message);
    }
}

// Middleware to initialize Redis for CartIDs
router.use(async (req, res, next) => {
    logger.info(`[Middleware] Received request for path: ${req.path}`);
    logger.info(`[Middleware] Session ID: ${req.sessionID}`);

    if (!req.sessionID) {
        logger.error('[Middleware] Session ID is missing.');
        return res.status(400).json({ error: 'Session ID is required.' });
    }

    try {
        const redisKey = `session:${req.sessionID}:cartIds`;
        logger.info(`[Middleware] Redis Key for session: ${redisKey}`);

        req.session.cartIds = JSON.parse(await redisClient.get(redisKey)) || [];
        logger.info(`[Middleware] Initialized Redis session for Cart IDs: ${JSON.stringify(req.session.cartIds)}`);
    } catch (error) {
        logger.error(`[Middleware] Failed to load Cart IDs from Redis: ${error.message}`);
        req.session.cartIds = []; // Fallback to an empty array
    }

    next();
});

// POST /set-cart-id Route
router.post('/', async (req, res) => {
    logger.info(`[POST /set-cart-id] Received request with body: ${JSON.stringify(req.body)}`);
    logger.info(`[POST /set-cart-id] Session ID: ${req.sessionID}`);

    const { cartId } = req.body;

    if (!cartId) {
        logger.error('[POST /set-cart-id] Cart ID is missing.');
        return res.status(400).json({ error: 'Cart ID is required.' });
    }

    try {
        // Validate and store the CartID
        const sessionCartIds = await validateAndStoreCartId(req.sessionID, cartId);

        // Set cookie for the validated CartID
        res.cookie('cartId', cartId, {
            secure: true,
            httpOnly: true,
            sameSite: 'None',
            maxAge: EXPIRATION_TIME,
        });

        logger.info(`[POST /set-cart-id] Successfully validated and stored Cart ID: ${cartId}`);
        logger.info(`[POST /set-cart-id] Updated session Cart IDs: ${JSON.stringify(sessionCartIds)}`);

        res.status(200).json({
            message: 'Cart ID validated and stored successfully.',
            sessionCartIds,
        });
    } catch (error) {
        logger.error(`[POST /set-cart-id] Error processing Cart ID: ${error.message}`);
        res.status(500).json({ error: 'Internal server error', details: error.message });
    }
});

export default router;
