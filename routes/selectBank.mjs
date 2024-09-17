import express from 'express';
import RelyingPartyClientSdk from '@connectid-tools/rp-nodejs-sdk';
import { config } from '../config.js';

const router = express.Router();
const rpClient = new RelyingPartyClientSdk(config);


router.post('/select-bank', async (req, res) => {
  const essentialClaims = req.body.essentialClaims || []
  const voluntaryClaims = req.body.voluntaryClaims || []
  const purpose = req.body.purpose || config.data.purpose
  const authServerId = req.body.authorisationServerId
  if (!authServerId) {
    const error = 'authorisationServerId parameter is required'
    logger.error(error)
    return res.status(400).json({ error })
  }

    console.log(`Claims Request: ${JSON.stringify(claimsRequest)}`);
    const cartId = req.body.cartId;
  
    if (!authServerId || !cartId) {
      const error = 'authorisationServerId and cartId are required';
      console.error(error);
      return res.status(400).json({ error });
    }
  
    try {
      // Send the pushed authorization request with the claims
      const { authUrl, code_verifier, state, nonce, xFapiInteractionId } = await rpClient.sendPushedAuthorisationRequest(
        authServerId,
        essentialClaims,
        voluntaryClaims,
        purpose
      )
  
      const cookieOptions = {
        path: '/',
        sameSite: 'None',
        secure: true,
        httpOnly: true,
        maxAge: 3 * 60 * 1000
      };
  
      res.cookie('state', state, cookieOptions);
      res.cookie('nonce', nonce, cookieOptions);
      res.cookie('code_verifier', code_verifier, cookieOptions);
      res.cookie('authorisation_server_id', authServerId, cookieOptions);
  
      console.log(`PAR sent to authorisationServerId='${authServerId}', returning authUrl='${authUrl}'`);
  
      return res.json({ authUrl });
    } catch (error) {
      console.error('Error during PAR request:', error);
      return res.status(500).json({ error: 'Failed to send PAR request', details: error.message });
    }
  });
  
  export default router;
  