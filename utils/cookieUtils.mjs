import express from 'express';
const router = express.Router();

// Named export for clearCookies function
export const clearCookies = (res, logger) => {
    logger.info('Clearing all cookies');
    res.clearCookie('state');
    res.clearCookie('nonce');
    res.clearCookie('code_verifier');
    res.clearCookie('authorisation_server_id');
};

// Default export for the router
export default router;
