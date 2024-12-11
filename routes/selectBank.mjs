import express from 'express';
import RelyingPartyClientSdk from '@connectid-tools/rp-nodejs-sdk';
import { config } from '../config.js';
import { getLogger } from '../utils/logger.mjs';
import { redisClient } from '../app.mjs'; // Import Redis client
import { jwtDecrypt } from 'jose';

const logger = getLogger('info');
const router = express.Router();
const rpClient = new RelyingPartyClientSdk(config);

const JWT_SECRET = process.env.JWT_SECRET || 'your-very-secret-key';
const EXPIRATION_TIME = 3600 * 1000; // 1 hour

// `/select-bank` route handler
router.post('/', async (req, res) => {
    const requestId = Date.now();
    logger.info(`[Request ${requestId}] Processing /select-bank request. Body: ${JSON.stringify(req.body)}`);

    const token = req.headers.authorization?.split(' ')[1]; // Extract token from Authorization header
    if (!token) {
        logger.error(`[Request ${requestId}] Missing Authorization token.`);
        return res.status(401).json({ error: 'Authorization token is required.' });
    }

    const essentialClaims = req.body.essentialClaims || [];
    const voluntaryClaims = req.body.voluntaryClaims || [];
    const purpose = req.body.purpose || config.data.purpose;
    const authServerId = req.body.authorisationServerId;
    const cartId = req.body.cartId;

    logger.info(`[Request ${requestId}] Received parameters: authServerId=${authServerId}, cartId=${cartId}, essentialClaims=${JSON.stringify(essentialClaims)}, voluntaryClaims=${JSON.stringify(voluntaryClaims)}`);

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
        logger.info(`[Request ${requestId}] Decrypting Authorization token.`);
        const { payload } = await jwtDecrypt(token, new TextEncoder().encode(JWT_SECRET));
        const decryptedCartId = payload.cartId;

        if (decryptedCartId !== cartId) {
            logger.error(`[Request ${requestId}] Cart ID in token (${decryptedCartId}) does not match provided Cart ID (${cartId}).`);
            return res.status(400).json({ error: 'Cart ID mismatch.' });
        }

        logger.info(`[Request ${requestId}] Decrypted JWT cartId: ${decryptedCartId}`);

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
        const { authUrl, code_verifier, state, nonce, xFapiInteractionId } =
            await rpClient.sendPushedAuthorisationRequest(
                authServerId,
                essentialClaims,
                voluntaryClaims,
                purpose
            );

        logger.info(`[Request ${requestId}] PAR request successful. Authorization URL: ${authUrl}`);

        // Set cookies for state management
        logger.info(`[Request ${requestId}] Setting cookies for state, nonce, and code_verifier.`);
        res.cookie('state', state, { secure: true, sameSite: 'None', httpOnly: true });
        res.cookie('nonce', nonce, { secure: true, sameSite: 'None', httpOnly: true });
        res.cookie('code_verifier', code_verifier, { secure: true, sameSite: 'None', httpOnly: true });

        return res.json({ authUrl });
    } catch (error) {
        logger.error(`[Request ${requestId}] Error during token decryption or PAR process: ${error.message}`);
        return res.status(500).json({ error: 'Internal server error', details: error.message });
    }
});

export default router;
