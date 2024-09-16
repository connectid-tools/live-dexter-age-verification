import express from 'express';
import RelyingPartyClientSdk from '@connectid-tools/rp-nodejs-sdk';
import { config } from '../config.js';

const router = express.Router();
const rpClient = new RelyingPartyClientSdk(config);

router.post('/select-bank', async (req, res) => {
  // Fetch essential and voluntary claims from request body
  const essentialClaims = {
    "auth_time": { "essential": true },
    "over18": { "essential": true }
  };
  const voluntaryClaims = req.body.voluntaryClaims || [];
  const purpose = req.body.purpose || 'Age verification required'; // Default purpose
  const authServerId = req.body.authorisationServerId;
  const cartId = req.body.cartId;

  // Validate that both the authorizationServerId and cartId are provided
  if (!authServerId || !cartId) {
    const error = 'authorisationServerId and cartId are required';
    console.error(error);
    return res.status(400).json({ error });
  }

  // Log essential and voluntary claims
  console.log(`Essential Claims: ${JSON.stringify(essentialClaims)}`);
  console.log(`Voluntary Claims: ${JSON.stringify(voluntaryClaims)}`);

  try {
    // Send the pushed authorization request with the claims
    const { authUrl, code_verifier, state, nonce, xFapiInteractionId } = await rpClient.sendPushedAuthorisationRequest(
      authServerId,
      essentialClaims,  // Use the essential claims
      voluntaryClaims,  // Pass voluntary claims
      purpose
    );

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
