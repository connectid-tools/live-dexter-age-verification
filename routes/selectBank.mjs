import express from 'express';
import RelyingPartyClientSdk from '@connectid-tools/rp-nodejs-sdk';
import { config } from '../config.js';
import { getLogger } from '../utils/logger.mjs'; // Import the logger

const logger = getLogger('info'); // Create a logger instance with the desired log level
const router = express.Router();
const rpClient = new RelyingPartyClientSdk(config);

router.post('/', async (req, res) => {
    const requestId = Date.now(); // Unique request identifier

    logger.info(`[Request ${requestId}] Incoming Headers: ${JSON.stringify(req.headers)}`);
    logger.info(`[Request ${requestId}] Incoming Cookies: ${JSON.stringify(req.cookies)}`);

    const essentialClaims = req.body.essentialClaims || [];
    const voluntaryClaims = req.body.voluntaryClaims || [];
    const purpose = req.body.purpose || config.data.purpose;
    const authServerId = req.body.authorisationServerId;
    const cartId = req.signedCookies.cartId;

    // Validation: Missing `authorisationServerId`
    if (!authServerId) {
        logger.error(`[Request ${requestId}] Error: Missing required 'authorisationServerId'.`);
        return res.status(400).json({ error: 'authorisationServerId parameter is required' });
    }

    // Validation: Missing `cartId` in cookies
    if (!cartId) {
        logger.error(`[Request ${requestId}] Error: Missing 'cartId' in cookies.`);
        return res.status(400).json({ error: 'cartId parameter is required' });
    }

    try {
        logger.info(`[Request ${requestId}] Processing PAR request with the following details:`);
        logger.info(`- authorisationServerId: ${authServerId}`);
        logger.info(`- essentialClaims: ${JSON.stringify(essentialClaims)}`);
        logger.info(`- voluntaryClaims: ${JSON.stringify(voluntaryClaims)}`);
        logger.info(`- purpose: ${purpose}`);

        // Send the pushed authorization request
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

        // Set cookies to maintain state
        res.cookie('state', state, { path: '/', sameSite: 'none', secure: true, httpOnly: true, maxAge: 5 * 60 * 1000 }); // 5 minutes
        res.cookie('nonce', nonce, { path: '/', sameSite: 'none', secure: true, httpOnly: true, maxAge: 5 * 60 * 1000 });
        res.cookie('code_verifier', code_verifier, { path: '/', sameSite: 'none', secure: true, httpOnly: true, maxAge: 5 * 60 * 1000 });
        res.cookie('authorisation_server_id', authServerId, { path: '/', sameSite: 'none', secure: true, httpOnly: true, maxAge: 5 * 60 * 1000 });

        logger.info(`[Request ${requestId}] Cookies successfully set for state management.`);

        // Return the authorization URL
        return res.json({ authUrl, state, nonce, code_verifier, authorisationServerId: authServerId });
    } catch (error) {
        logger.error(`[Request ${requestId}] Error during PAR request: ${error.stack || error.message}`);
        return res.status(500).json({ error: 'Failed to send PAR request', details: error.message });
    }
});

export default router;
