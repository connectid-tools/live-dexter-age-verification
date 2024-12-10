import jwt from 'jsonwebtoken';
import express from 'express';
import fetch from 'node-fetch';
import { getLogger } from '../utils/logger.mjs';
import { redisClient } from '../app.mjs'; // Import the shared Redis client

const JWT_SECRET = process.env.JWT_SECRET || 'your-very-secret-key';
const JWT_EXPIRATION = '1h'; // Token validity duration
const logger = getLogger('info');
const router = express.Router();

const BIGCOMMERCE_API_URL = 'https://api.bigcommerce.com/stores/pmsgmprrgp/v3';
const ACCESS_TOKEN = process.env.ACCESS_TOKEN; // BigCommerce API token
const EXPIRATION_TIME = 3600 * 1000; // 1 hour in milliseconds

// Helper function to validate and store a CartID
async function validateAndStoreCartId(cartId) {
    logger.info(`[validateAndStoreCartId] Cart ID: ${cartId}`);

    try {
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
        return { cartId, timestamp: Date.now() }; // Return validated cartId with timestamp
    } catch (error) {
        logger.error(`[validateAndStoreCartId] Failed to validate Cart ID: ${error.message}`);
        throw new Error(error.message);
    }
}

// Middleware to validate JWT and attach session data
router.use((req, res, next) => {
    const excludedRoutes = ['/set-cart-id']; // List of routes to bypass JWT validation
    if (excludedRoutes.includes(req.path)) {
        logger.info(`[Middleware] Bypassing JWT validation for route: ${req.path}`);
        return next(); // Skip JWT validation for excluded routes
    }

    const token = req.headers.authorization?.split(' ')[1]; // Extract token from Authorization header
    if (!token) {
        logger.error('[Middleware] Missing Authorization token.');
        return res.status(401).json({ error: 'Authorization token is required.' });
    }

    try {
        const decoded = jwt.verify(token, JWT_SECRET); // Verify and decode JWT
        req.sessionData = decoded; // Attach session data to request object
        logger.info(`[Middleware] Decoded JWT: ${JSON.stringify(decoded)}`);
        next();
    } catch (error) {
        logger.error('[Middleware] Invalid or expired token.');
        return res.status(401).json({ error: 'Invalid or expired token.' });
    }
});

// POST /set-cart-id Route
router.post('/set-cart-id', async (req, res) => {
    logger.info(`[POST /set-cart-id] Received request with body: ${JSON.stringify(req.body)}`);

    const { cartId } = req.body;

    if (!cartId) {
        logger.error('[POST /set-cart-id] Cart ID is missing.');
        return res.status(400).json({ error: 'Cart ID is required.' });
    }

    try {
        // Validate and store the CartID
        const validatedCart = await validateAndStoreCartId(cartId);

        // Store the validated cart ID in Redis
        const redisKey = `session:${cartId}:cartData`;
        await redisClient.set(redisKey, JSON.stringify(validatedCart), {
            EX: EXPIRATION_TIME / 1000, // Set expiration time in seconds
        });

        logger.info(`[POST /set-cart-id] Stored validated Cart ID: ${cartId} in Redis.`);

        // Generate JWT token
        const sessionToken = jwt.sign({ cartId }, JWT_SECRET, { expiresIn: JWT_EXPIRATION });

        res.status(200).json({
            message: 'Cart ID validated and stored successfully.',
            sessionToken, // Return the token to the client
        });
    } catch (error) {
        logger.error(`[POST /set-cart-id] Error processing Cart ID: ${error.message}`);
        res.status(500).json({ error: 'Internal server error', details: error.message });
    }
});

export default router;
