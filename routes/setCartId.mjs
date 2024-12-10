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
    try {
        // Fetch and filter expired cart IDs
        const cartIds = JSON.parse(await redisClient.get(redisKey)) || [];
        const filteredCartIds = cartIds.filter(cart => Date.now() - cart.timestamp <= EXPIRATION_TIME);

        // Validate new CartID with BigCommerce API
        const response = await fetch(`${BIGCOMMERCE_API_URL}/carts/${cartId}`, {
            method: 'GET',
            headers: {
                'X-Auth-Token': ACCESS_TOKEN,
                'Content-Type': 'application/json',
            },
        });

        if (!response.ok) throw new Error(`BigCommerce API error: ${response.statusText}`);

        // Add validated CartID to the filtered list
        filteredCartIds.push({ cartId, timestamp: Date.now() });

        // Update Redis atomically
        await redisClient
            .multi()
            .set(redisKey, JSON.stringify(filteredCartIds))
            .expire(redisKey, EXPIRATION_TIME / 1000)
            .exec();

        logger.info(`Stored validated Cart ID: ${cartId}`);
        return filteredCartIds;
    } catch (error) {
        logger.error(`Failed to validate/store Cart ID: ${error.message}`);
        throw new Error(error.message);
    }
}

// Middleware to initialize or refresh Redis data for CartIDs
router.use(async (req, res, next) => {
    if (!req.sessionID) {
        logger.error('Session ID is missing.');
        return res.status(400).json({ error: 'Session ID is required.' });
    }

    try {
        const redisKey = `session:${req.sessionID}:cartIds`;
        req.session.cartIds = JSON.parse(await redisClient.get(redisKey)) || [];
        logger.info(`Redis initialized for Cart IDs: ${JSON.stringify(req.session.cartIds)}`);
    } catch (error) {
        logger.error(`Failed to load Cart IDs from Redis: ${error.message}`);
        req.session.cartIds = []; // Fallback to an empty array
    }
    next();
});

// POST /set-cart-id Route
router.post('/', async (req, res) => {
    const { cartId } = req.body;

    if (!cartId) {
        logger.error('Cart ID is missing.');
        return res.status(400).json({ error: 'Cart ID is required.' });
    }

    try {
        const sessionCartIds = await validateAndStoreCartId(req.sessionID, cartId);

        // Set cookie for the validated CartID
        res.cookie('cartId', cartId, {
            secure: true,
            httpOnly: true,
            sameSite: 'None',
            maxAge: EXPIRATION_TIME,
        });

        logger.info(`Successfully validated and stored Cart ID: ${cartId}`);
        res.status(200).json({
            message: 'Cart ID validated and stored successfully.',
            sessionCartIds,
        });
    } catch (error) {
        logger.error(`Error processing Cart ID: ${error.message}`);
        res.status(500).json({ error: 'Internal server error', details: error.message });
    }
});

export default router;
