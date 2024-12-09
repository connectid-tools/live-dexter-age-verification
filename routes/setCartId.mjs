import express from 'express';
import fetch from 'node-fetch';
import { getLogger } from '../utils/logger.mjs';

const logger = getLogger('info');
const router = express.Router();

const BIGCOMMERCE_API_URL = 'https://api.bigcommerce.com/stores/pmsgmprrgp/v3';
const ACCESS_TOKEN = process.env.ACCESS_TOKEN; // BigCommerce API token

router.post('/', async (req, res) => {

    const requestId = Date.now(); // Generate a unique request ID for correlation

    logger.info(`[Request ${requestId}] Starting /set-cart-id request.`);
    logger.info(`[Request ${requestId}] Incoming Headers: ${JSON.stringify(req.headers)}`);
    logger.info(`[Request ${requestId}] Incoming Cookies: ${JSON.stringify(req.cookies)}`);
    logger.info(`[Request ${requestId}] Incoming Session Before Mutation: ${JSON.stringify(req.session)}`);


    const { cartId } = req.body;

    
    if (!cartId) {
        const error = 'cartId parameter is required';
        logger.error(`[Request ${requestId}] Error: ${error}`);
        return res.status(400).json({ error });
    }
    

    try {

        logger.info(`[Request ${requestId}] Validating cartId: ${cartId} with BigCommerce API.`);

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

        if (!response.ok) {
            const error = `BigCommerce API error: ${response.statusText}`;
            logger.error(`[Request ${requestId}] Error: ${error}`);
            throw new Error(error);
        }

        const cartData = await response.json();
        logger.info(`[Request ${requestId}] Cart data retrieved successfully from BigCommerce API: ${JSON.stringify(cartData)}`);

        logger.info(`[Request ${requestId}] Storing cartId: ${cartId} in session.`);
        req.session.cartId = cartId;

        req.session.save((err) => {
            if (err) {
                const error = `Session save failed: ${err.message}`;
                logger.error(`[Request ${requestId}] Error: ${error}`);
                return res.status(500).json({ error: 'Error saving session data' });
            }

            logger.info(`[Request ${requestId}] Session After Mutation: ${JSON.stringify(req.session)}`);
            logger.info(`[Request ${requestId}] Cart ID ${cartId} validated and stored in session.`);

            // Add a listener to log cookies when the response is finalized
            res.on('finish', () => {
                const cookies = res.getHeaders()['set-cookie'];
                logger.info(`[Request ${requestId}] Outgoing Cookies: ${JSON.stringify(cookies)}`);
            });

            res.status(200).json({ message: 'Cart ID validated and stored successfully', cart: cartData });
        });
    } catch (error) {
        logger.error(`[Request ${requestId}] Error in /set-cart-id: ${error.stack || error.message}`);
        res.status(500).json({ error: error.message });
    } finally {
        logger.info(`[Request ${requestId}] Completed /set-cart-id request.`);
    }
});

export default router;
