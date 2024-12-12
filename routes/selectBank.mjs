import express from 'express';
import RelyingPartyClientSdk from '@connectid-tools/rp-nodejs-sdk';
import { config } from '../config.js';
import { getLogger } from '../utils/logger.mjs';
import { redisClient } from '../app.mjs'; // Import Redis client
import jwt from 'jsonwebtoken'; // Import JWT library

const logger = getLogger('info');
const router = express.Router();
const rpClient = new RelyingPartyClientSdk(config);

const EXPIRATION_TIME = 3600 * 1000; // 1 hour

// Helper function to clean up expired cart IDs in Redis
async function cleanupExpiredCartIds() {
    const keys = await redisClient.keys('session:*:cartData');
    for (const key of keys) {
        const data = JSON.parse(await redisClient.get(key));
        if (Date.now() - data.timestamp > EXPIRATION_TIME) {
            await redisClient.del(key);
            logger.info(`Expired cart ID removed: ${key}`);
        }
    }
}

// Middleware to load cart IDs from Redis
router.use(async (req, res, next) => {
    const redisKey = `session:${req.cookies.cartId}:cartData`;

    // Log cookies
    logger.info(`[Middleware] Cookies: ${JSON.stringify(req.cookies)}`);
    logger.info(`[Middleware] Attempting to load Redis key: ${redisKey}`);
     
    try {
        req.session.cartData = JSON.parse(await redisClient.get(redisKey)) || null;
        logger.info(`[Middleware] Loaded cart data for Cart ID ${req.cookies.cartId}: ${req.session.cartData}`);
    } catch (error) {
        logger.error(`[Middleware] Failed to load cart data: ${error.message}`);
    }
    next();
});

// `/select-bank` route handler
router.post('/', async (req, res) => {
    const requestId = Date.now();
    logger.info(`[Request ${requestId}] Processing /select-bank request. Body: ${JSON.stringify(req.body)}`);

    // Retrieve session token from the cookie
    const sessionToken = req.cookies.sessionToken;

    if (!sessionToken) {
        logger.error(`[Request ${requestId}] Missing session token.`);
        return res.status(401).json({ error: 'Unauthorized: No session token provided.' });
    }

    let cartId;
    try {
        // Verify the JWT and extract the cartId
        const decoded = jwt.verify(sessionToken, JWT_SECRET);
        cartId = decoded.cartId;
        logger.info(`[Request ${requestId}] Session token verified. Cart ID: ${cartId}`);
    } catch (error) {
        logger.error(`[Request ${requestId}] Invalid or expired session token.`);
        return res.status(401).json({ error: 'Unauthorized: Invalid or expired session token.' });
    }

    const essentialClaims = req.body.essentialClaims || [];
    const voluntaryClaims = req.body.voluntaryClaims || [];
    const purpose = req.body.purpose || config.data.purpose;
    const authServerId = req.body.authorisationServerId;

    logger.info(`[Request ${requestId}] Received parameters: authServerId=${authServerId}, essentialClaims=${JSON.stringify(essentialClaims)}, voluntaryClaims=${JSON.stringify(voluntaryClaims)}`);

    // Validate required fields
    if (!authServerId) {
        logger.error(`[Request ${requestId}] Missing 'authorisationServerId'.`);
        return res.status(400).json({ error: 'authorisationServerId parameter is required' });
    }

    try {
        // Clean up expired cart IDs
        await cleanupExpiredCartIds();

        // Validate that the cart ID exists in Redis
        const redisKey = `session:${cartId}:cartData`;

        logger.info(`[Request ${requestId}] Checking Redis for Cart ID: ${cartId}`);
        const cartData = await redisClient.get(redisKey);
        if (!cartData) {
            logger.error(`[Request ${requestId}] Cart ID ${cartId} not found or expired.`);
            return res.status(400).json({ error: 'Invalid or expired cart ID.' });
        }
        logger.info(`[Request ${requestId}] Cart ID ${cartId} is valid. Redis Data: ${cartData}`);

        // Send the pushed authorization request
        logger.info(`[Request ${requestId}] Sending Pushed Authorization Request (PAR) to auth server: ${authServerId}`);

        const {
            authUrl,
            code_verifier,
            state,
            nonce,
            xFapiInteractionId,
        } = await rpClient.sendPushedAuthorisationRequest(
            authServerId,
            essentialClaims,
            voluntaryClaims,
            purpose
        );

        logger.info(`[Request ${requestId}] PAR request successful. Received response:`);
        logger.info(`- authUrl: ${authUrl}`);
        logger.info(`- state: ${state}`);
        logger.info(`- nonce: ${nonce}`);
        logger.info(`- code_verifier: ${code_verifier}`);
        logger.info(`- xFapiInteractionId: ${xFapiInteractionId}`);

        // Set cookies for state management
        logger.info(`[Request ${requestId}] Setting cookies for state, nonce, and code_verifier.`);
        res.cookie('state', state, { path: '/', sameSite: 'none', secure: true, httpOnly: true, maxAge: 5 * 60 * 1000 }); // 5 minutes
        res.cookie('nonce', nonce, { path: '/', sameSite: 'none', secure: true, httpOnly: true, maxAge: 5 * 60 * 1000 });
        res.cookie('code_verifier', code_verifier, { path: '/', sameSite: 'none', secure: true, httpOnly: true, maxAge: 5 * 60 * 1000 });
        res.cookie('authorisation_server_id', authServerId, { path: '/', sameSite: 'none', secure: true, httpOnly: true, maxAge: 5 * 60 * 1000 });

        return res.json({ authUrl, state, nonce, code_verifier, authorisationServerId: authServerId });
    } catch (error) {
        logger.error(`[Request ${requestId}] Error during PAR request: ${error.stack || error.message}`);
        return res.status(500).json({ error: 'Internal server error', details: error.message });
    }
});


export default router;