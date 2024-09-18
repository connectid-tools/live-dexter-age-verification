import express from 'express';
import RelyingPartyClientSdk from '@connectid-tools/rp-nodejs-sdk';
import { config } from '../config.js';

const router = express.Router();
const rpClient = new RelyingPartyClientSdk(config);

router.post('/select-bank', async (req, res) => {
  const essentialClaims = req.body.essentialClaims || [];
  const voluntaryClaims = req.body.voluntaryClaims || [];
  const purpose = req.body.purpose || config.data.purpose;
  const authServerId = req.body.authorisationServerId;

  console.log('Received request with payload:', req.body); // Log the incoming request payload

  if (!authServerId) {
    const error = 'authorisationServerId parameter is required';
    console.error('Error:', error);
    return res.status(400).json({ error });
  }

  const cartId = req.body.cartId;
  if (!cartId) {
    const error = 'cartId parameter is required';
    console.error('Error:', error);
    return res.status(400).json({ error });
  }

  try {
    console.log('Sending PAR request to auth server with details:');
    console.log(`- Authorisation Server ID: ${authServerId}`);
    console.log(`- Essential Claims: ${JSON.stringify(essentialClaims)}`);
    console.log(`- Voluntary Claims: ${JSON.stringify(voluntaryClaims)}`);
    console.log(`- Purpose: ${purpose}`);

    // Send the pushed authorization request
    const { authUrl, code_verifier, state, nonce, xFapiInteractionId } = await rpClient.sendPushedAuthorisationRequest(
      authServerId,
      essentialClaims,
      voluntaryClaims,
      purpose
    );

    console.log(`PAR request sent successfully. Received response from auth server.`);
    console.log(`- Auth URL: ${authUrl}`);
    console.log(`- Code Verifier: ${code_verifier}`);
    console.log(`- State: ${state}`);
    console.log(`- Nonce: ${nonce}`);
    console.log(`- xFapiInteractionId: ${xFapiInteractionId}`);

    const cookieOptions = {
      path: '/',
      sameSite: 'None',
      secure: true,
      httpOnly: true,
      maxAge: 3 * 60 * 1000 // 3 minutes
    };

    console.log('Setting cookies for state, nonce, code_verifier, and authorisation_server_id:');
    console.log(`- state: ${state}`);
    console.log(`- nonce: ${nonce}`);
    console.log(`- code_verifier: ${code_verifier}`);
    console.log(`- authorisation_server_id: ${authServerId}`);

    // Set cookies to maintain state
    res.cookie('state', state, cookieOptions);
    res.cookie('nonce', nonce, cookieOptions);
    res.cookie('code_verifier', code_verifier, cookieOptions);
    res.cookie('authorisation_server_id', authServerId, cookieOptions);

    console.log('Cookies set successfully for state, nonce, code_verifier, and authorisation_server_id');

    return res.json({ authUrl });
  } catch (error) {
    console.error('Error during PAR request:', error);
    return res.status(500).json({ error: 'Failed to send PAR request', details: error.message });
  }
});

export default router;
