    import express from 'express';
    import fetch from 'node-fetch';
    import { getLogger } from '../utils/logger.mjs';

    const logger = getLogger('info');
    const router = express.Router();

    const BIGCOMMERCE_API_URL = 'https://api.bigcommerce.com/stores/pmsgmprrgp/v3';
    const ACCESS_TOKEN = process.env.ACCESS_TOKEN; // BigCommerce API token

    // Expiration time for cartIds (1 hour in milliseconds)
        const EXPIRATION_TIME = 3600 * 1000;

        // Middleware to initialize session cartIds array
        router.use((req, res, next) => {
            if (!req.session.cartIds) {
                req.session.cartIds = []; // Initialize array if not present
            }
            next();
        });

                // Helper function to clean up expired cartIds
        function cleanupExpiredCartIds(session) {
            session.cartIds = session.cartIds.filter(cart => {
                const isExpired = Date.now() - cart.timestamp > EXPIRATION_TIME;
                if (isExpired) {
                    logger.info(`Cart ID ${cart.cartId} expired and removed.`);
                }
                return !isExpired;
            });
        }

    router.post('/', async (req, res) => {
        const { cartId } = req.body;

        // Ensure cartId is provided
        if (!cartId) {
            logger.error('cartId parameter is required');
            return res.status(400).json({ error: 'cartId parameter is required' });
        }
        logger.info('Session after adding cart ID:', req.session);

        try {

            cleanupExpiredCartIds(req.session);
            
            // Call BigCommerce API to validate the cartId
            const response = await fetch(`${BIGCOMMERCE_API_URL}/carts/${cartId}`, {
                method: 'GET',
                headers: {
                    'X-Auth-Token': ACCESS_TOKEN,
                    'Content-Type': 'application/json',
                },
            });

            // Handle invalid cartId (404)
            if (response.status === 404) {
                logger.error(`Invalid cartId: ${cartId}`);
                return res.status(400).json({ error: 'Invalid cartId or cart does not exist' });
            }

            // Handle unexpected errors
            if (!response.ok) {
                throw new Error(`BigCommerce API error: ${response.statusText}`);
            }

            // Parse valid cart data
            const cartData = await response.json();

                // Add cartId with timestamp to session array if not already present
            if (!req.session.cartIds.some(cart => cart.cartId === cartId)) {
                req.session.cartIds.push({ cartId, timestamp: Date.now() });
                logger.info(`Cart ID ${cartId} added to session.`);
            } else {
                logger.info(`Cart ID ${cartId} is already in session.`);
            }

                // Respond with success and return the list of cartIds
            return res.status(200).json({
                message: 'Cart ID validated and stored successfully',
                cart: cartData,
                cartIds: req.session.cartIds.map(cart => cart.cartId), // Return only cartId values
            });
        } catch (error) {
            logger.error(`Error validating cartId: ${error.message}`);
            return res.status(500).json({ error: 'Internal server error' });
        }
    });

    export default router;