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
async function validateAndStoreCartId(cartId) {
    logger.info(`[validateAndStoreCartId] Start - Cart ID: ${cartId}`);

    try {
        // Validate new CartID using BigCommerce API
        logger.info(`[validateAndStoreCartId] Sending API request to validate Cart ID: ${cartId}`);
        const response = await fetch(`${BIGCOMMERCE_API_URL}/carts/${cartId}`, {
            method: 'GET',
            headers: {
                'X-Auth-Token': ACCESS_TOKEN,
                'Content-Type': 'application/json',
            },
        });

        logger.info(`[validateAndStoreCartId] BigCommerce API response status: ${response.status}`);
        if (!response.ok) {
            const errorText = `BigCommerce API error: ${response.statusText}`;
            logger.error(`[validateAndStoreCartId] ${errorText}`);
            throw new Error(errorText);
        }

        const data = await response.json();
        logger.info(`[validateAndStoreCartId] API response data: ${JSON.stringify(data)}`);

        logger.info(`[validateAndStoreCartId] BigCommerce validation successful for Cart ID: ${cartId}`);
        return { cartId, timestamp: Date.now() }; // Return validated cartId with timestamp
    } catch (error) {
        logger.error(`[validateAndStoreCartId] Failed to validate Cart ID: ${error.message}`);
        throw new Error(error.message);
    }
}

// POST /set-cart-id Route
router.post('/', async (req, res) => {
    logger.info(`[POST /set-cart-id] Start - Received request with body: ${JSON.stringify(req.body)}`);

    const { cartId } = req.body;

    if (!cartId) {
        logger.error('[POST /set-cart-id] Cart ID is missing.');
        logger.info(`[POST /set-cart-id] Headers: ${JSON.stringify(req.headers)}`);
        logger.info(`[POST /set-cart-id] Body: ${JSON.stringify(req.body)}`);
        return res.status(400).json({ error: 'Cart ID is required.' });
    }

    try {
        // Validate and store the CartID
        logger.info(`[POST /set-cart-id] Validating Cart ID: ${cartId}`);
        const validatedCart = await validateAndStoreCartId(cartId);

        // Store the validated cart ID in Redis
        const redisKey = `session:${cartId}:cartData`;
        logger.info(`[POST /set-cart-id] Storing validated Cart ID in Redis with key: ${redisKey}`);
        await redisClient.set(redisKey, JSON.stringify(validatedCart), {
            EX: EXPIRATION_TIME / 1000, // Set expiration time in seconds
        });

        logger.info(`[POST /set-cart-id] Stored validated Cart ID: ${cartId} in Redis.`);

        // Set cookie with the cartId for session tracking
        logger.info(`[POST /set-cart-id] Setting cookie for Cart ID.`);
        res.cookie('sessionToken', cartId, {
            httpOnly: false,
            secure: true, // Only secure in production
            sameSite: 'None', // Allows cross-origin cookies
            maxAge: EXPIRATION_TIME, // 1 hour
            domain: process.env.STORE_DOMAIN || undefined, // Set to match client domain
        });

        res.status(200).json({
            message: 'Cart ID validated and stored successfully.',
            sessionToken: cartId, // Return the cartId as the session token
        });
    } catch (error) {
        logger.error(`[POST /set-cart-id] Error processing Cart ID: ${error.message}`);
        res.status(500).json({ error: 'Internal server error', details: error.message });
    }
});

export default router;