import express from 'express';
import RelyingPartyClientSdk from '@connectid-tools/rp-nodejs-sdk';
import { config } from '../config.js';
import { getLogger } from '../utils/logger.mjs';
import { redisClient } from '../app.mjs'; // Import Redis client
import { jwtDecrypt } from 'jose';


const logger = getLogger('info');
const router = express.Router();
const rpClient = new RelyingPartyClientSdk(config);

const ENCRYPTION_SECRET = '4beced985ddf9a778fc9e4656e315ce9c5bb645a3c5ba6887391fd469a74ce32';
if (ENCRYPTION_SECRET.length !== 32) {
    throw new Error(`Invalid encryption key length: ${ENCRYPTION_SECRET.length * 8} bits. Expected 256 bits.`);
}

const EXPIRATION_TIME = 3600 * 1000; // 1 hour

// `/select-bank` route handler
router.post('/', async (req, res) => {
    const requestId = Date.now();
    logger.info(`[Request ${requestId}] Processing /select-bank request. Body: ${JSON.stringify(req.body)}`);

    const sessionToken = req.cookies.sessionToken; // Retrieve the encrypted JWT from the cookie
    if (!sessionToken) {
        logger.error(`[Request ${requestId}] Missing session token.`);
        return res.status(401).json({ error: 'Session token is required.' });
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
        logger.info(`[Request ${requestId}] Decrypting session token.`);
        const { payload } = await jwtDecrypt(sessionToken, new TextEncoder().encode(ENCRYPTION_SECRET));
        const cartId = payload.cartId;

        if (!cartId) {
            logger.error(`[Request ${requestId}] Cart ID missing in decrypted session token.`);
            return res.status(400).json({ error: 'Cart ID is required.' });
        }

        logger.info(`[Request ${requestId}] Decrypted Cart ID: ${cartId}`);

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
