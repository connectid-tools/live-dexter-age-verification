import express from 'express';
import fetch from 'node-fetch';
import { getLogger } from '../utils/logger.mjs';

const logger = getLogger('info');
const router = express.Router();

const BIGCOMMERCE_API_URL = 'https://api.bigcommerce.com/stores/pmsgmprrgp/v3';
const ACCESS_TOKEN = process.env.ACCESS_TOKEN; // BigCommerce API token
const EXPIRATION_TIME = 3600 * 1000;

// Helper function to validate and store a CartID
async function validateAndStoreCartId(sessionId, cartId) {
    const redisKey = `session:${sessionId}:cartIds`;
    try {
        // Cleanup expired CartIDs
        const cartIds = JSON.parse(await redisClient.get(redisKey)) || [];
        const filteredCartIds = cartIds.filter(cart => Date.now() - cart.timestamp <= EXPIRATION_TIME);

        // Validate new CartID
        const response = await fetch(`${BIGCOMMERCE_API_URL}/carts/${cartId}`, {
            method: 'GET',
            headers: {
                'X-Auth-Token': ACCESS_TOKEN,
                'Content-Type': 'application/json',
            },
        });

        if (!response.ok) throw new Error(`BigCommerce API error: ${response.statusText}`);

        // Add the validated CartID
        filteredCartIds.push({ cartId, timestamp: Date.now() });
        await redisClient.set(redisKey, JSON.stringify(filteredCartIds));
        await redisClient.expire(redisKey, EXPIRATION_TIME / 1000); // Set expiration in seconds
        return filteredCartIds;
    } catch (error) {
        throw new Error(`Failed to validate and store CartID: ${error.message}`);
    }
}

// Middleware to initialize Redis storage for CartIDs
router.use(async (req, res, next) => {
    if (!req.sessionID) {
        logger.error('Session ID is missing.');
        return res.status(400).json({ error: 'Session ID is required.' });
    }

    try {
        const redisKey = `session:${req.sessionID}:cartIds`;
        req.session.cartIds = JSON.parse(await redisClient.get(redisKey)) || [];
    } catch (error) {
        logger.error(`Failed to load CartIDs from Redis: ${error.message}`);
        req.session.cartIds = []; // Fallback to an empty array
    }
    next();
});

// POST /set-cart-id route
router.post('/', async (req, res) => {
    const { cartId } = req.body;

    // Ensure cartId is provided
    if (!cartId) {
        logger.error('cartId parameter is required');
        return res.status(400).json({ error: 'cartId parameter is required' });
    }

    try {
        // Validate and store the CartID
        const sessionCartIds = await validateAndStoreCartId(req.sessionID, cartId);

        // Return success response
        res.status(200).json({
            message: 'Cart ID validated and stored successfully',
            sessionCartIds,
        });
    } catch (error) {
        logger.error(`Error validating cartId: ${error.message}`);
        return res.status(500).json({ error: 'Internal server error', details: error.message });
    }
});

export default router;
