import jwt from 'jsonwebtoken';
import express from 'express';
import fetch from 'node-fetch';
import { getLogger } from '../utils/logger.mjs';
import { redisClient } from '../app.mjs'; // Import the shared Redis client
import { EncryptJWT } from 'jose';
import * as crypto from 'crypto';


const logger = getLogger('info');
const router = express.Router();

const BIGCOMMERCE_API_URL = 'https://api.bigcommerce.com/stores/pmsgmprrgp/v3';
const ACCESS_TOKEN = process.env.ACCESS_TOKEN; // BigCommerce API token
const EXPIRATION_TIME = 3600 * 1000; // 1 hour in milliseconds
const JWT_EXPIRATION = '1h'; // JWT expiration

const hexKey = '4beced985ddf9a778fc9e4656e315ce9c5bb645a3c5ba6887391fd469a74ce32';
const bufferKey = Buffer.from(hexKey, 'hex');

console.log('Hex Key Length:', hexKey.length); // Logs: 64
console.log('Buffer Key Length:', bufferKey.length); // Logs: 32

const ENCRYPTION_SECRET = Buffer.from(
    '4beced985ddf9a778fc9e4656e315ce9c5bb645a3c5ba6887391fd469a74ce32',
    'hex'
); // Ensure this matches exactly

console.log('ENCRYPTION_SECRET Length:', ENCRYPTION_SECRET.length); // Should log 32



    
// Helper function to validate and store a CartID
async function validateAndStoreCartId(cartId) {
    logger.info(`[validateAndStoreCartId] Start - Cart ID: ${cartId}`);

    try {
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
        return { cartId, timestamp: Date.now() };
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
        return res.status(400).json({ error: 'Cart ID is required.' });
    }

    try {
        logger.info(`[POST /set-cart-id] Validating Cart ID: ${cartId}`);
        const validatedCart = await validateAndStoreCartId(cartId);

        const redisKey = `session:${cartId}:cartData`;
        logger.info(`[POST /set-cart-id] Storing validated Cart ID in Redis with key: ${redisKey}`);
        await redisClient.set(redisKey, JSON.stringify(validatedCart), {
            EX: EXPIRATION_TIME / 1000, // Set expiration time in seconds
        });

        logger.info(`[POST /set-cart-id] Successfully stored Cart ID in Redis.`);

        
        
        // Encrypt the JWT token
        logger.info(`[POST /set-cart-id] Encrypting JWT token for Cart ID: ${cartId}`);
        const sessionToken = await new EncryptJWT({ cartId })
        .setProtectedHeader({ alg: 'dir', enc: 'A256GCM' })
        .setIssuedAt()
        .setExpirationTime(JWT_EXPIRATION)
        .encrypt(ENCRYPTION_SECRET);

        console.log('ENCRYPTION_SECRET Length:', ENCRYPTION_SECRET.length); // Should log 32
        console.log('Generated Token:', sessionToken);


        logger.info(`[POST /set-cart-id] Successfully encrypted JWT token.`);

        // Set cookie for the encrypted JWT
        logger.info(`[POST /set-cart-id] Setting encrypted JWT in cookie.`);
        res.cookie('sessionToken', sessionToken, {
            httpOnly: false,
            secure: true,
            sameSite: 'None',
            maxAge: 3600 * 1000,
            domain: 'sh-checkout-validator-qud6t.ondigitalocean.app', // Match the server domain
        })        

        res.status(200).json({
            message: 'Cart ID validated and stored successfully.',
            sessionToken, // Include the encrypted token
        });
    } catch (error) {
        logger.error(`[POST /set-cart-id] Error processing Cart ID: ${error.message}`);
        res.status(500).json({ error: 'Internal server error', details: error.message });
    }
});

export default router;
