import express from 'express';
import RelyingPartyClientSdk from '@connectid-tools/rp-nodejs-sdk';
import { config } from '../config.js';
import { clearCookies } from '../utils/cookieUtils.mjs';
import { jwtDecode } from 'jwt-decode';
import { getLogger } from '../utils/logger.mjs';

const router = express.Router();
const rpClient = new RelyingPartyClientSdk(config);
const logger = getLogger('info');

function getXFapiInteractionId(error) {
  return error?.response?.headers['x-fapi-interaction-id'] || 'Unknown';
}

async function retrieveTokensWithErrorHandling(...args) {
  try {
    return await rpClient.retrieveTokens(...args);
  } catch (error) {
    const xFapiInteractionId = getXFapiInteractionId(error);
    const authorisationServerId = args[0];
    logger.error(`Error retrieving tokens from server ${authorisationServerId}, x-fapi-interaction-id: ${xFapiInteractionId}, ${error.message}`);
    logger.debug({ stack: error.stack, details: error });
    throw error;
  }
}

router.get('/retrieve-tokens', async (req, res) => {
  const { code } = req.query;

  if (!code) {
    return res.status(400).json({ error: 'Code parameter is required' });
  }

  const { authorisation_server_id, code_verifier, state, nonce } = req.cookies;

  if (!authorisation_server_id || !code_verifier || !state || !nonce) {
    return res.status(400).json({ error: 'Missing required cookies for token retrieval' });
  }

  try {
    const tokenSet = await retrieveTokensWithErrorHandling(authorisation_server_id, req.query, code_verifier, state, nonce);
    const claims = tokenSet.claims();
    const token = {
      decoded: jwtDecode(tokenSet.id_token),
      raw: tokenSet.id_token,
    };

    clearCookies(res);

    return res.status(200).json({
      claims,
      token,
      xFapiInteractionId: tokenSet.xFapiInteractionId,
    });

  } catch (error) {
    const xFapiInteractionId = getXFapiInteractionId(error);
    logger.error('Error during operation:', {
      message: error.message,
      name: error.name,
      stack: error.stack,
      details: error.details || 'No additional details available',
      xFapiInteractionId,
    });
    logger.error('Complete error object:', error);

    clearCookies(res);

    return res.status(500).json({
      error: 'Operation failed',
      details: error.message,
      fullError: {
        message: error.message,
        name: error.name,
        stack: error.stack,
        details: error.details || null,
        xFapiInteractionId,
      },
    });
  }
});

export default router;
