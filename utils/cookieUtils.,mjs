
import express from 'express';
const router = express.Router();


export const clearCookies = (res, logger) => {
    logger.info('Clearing all cookies');
    res.clearCookie('state');
    res.clearCookie('nonce');
    res.clearCookie('code_verifier');
    res.clearCookie('authorisation_server_id');
  };

  export default router;
