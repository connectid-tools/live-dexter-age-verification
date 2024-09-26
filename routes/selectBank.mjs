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

  // console.log('--- Received request with payload ---');
  // console.log('Payload:', JSON.stringify(req.body, null, 2)); // Log the incoming request payload

  // Check if the `authorisationServerId` is missing
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
    // console.log('--- Sending PAR request to auth server ---');
    // console.log(`- Authorisation Server ID: ${authServerId}`);
    // console.log(`- Essential Claims: ${JSON.stringify(essentialClaims)}`);
    // console.log(`- Voluntary Claims: ${JSON.stringify(voluntaryClaims)}`);
    // console.log(`- Purpose: ${purpose}`);

    // Send the pushed authorization request
    const { authUrl, code_verifier, state, nonce, xFapiInteractionId } = await rpClient.sendPushedAuthorisationRequest(
      authServerId,
      essentialClaims,
      voluntaryClaims,
      purpose
    );

    // console.log('--- PAR request sent successfully ---');
    // console.log(`- Auth URL: ${authUrl}`);
    // console.log(`- Code Verifier: ${code_verifier}`);
    // console.log(`- State: ${state}`);
    // console.log(`- Nonce: ${nonce}`);
    // console.log(`- xFapiInteractionId: ${xFapiInteractionId}`);

    // Cookie options
    const cookieOptions = {
      path: '/',
      sameSite: 'None',
      secure: true,
      httpOnly: true,
      maxAge: 3 * 60 * 1000 // 3 minutes
    };

    // Log the cookies before setting
    // console.log('--- Setting cookies ---');
    // console.log(`- Setting state: ${state}`);
    // console.log(`- Setting nonce: ${nonce}`);
    // console.log(`- Setting code_verifier: ${code_verifier}`);
    // console.log(`- Setting authorisation_server_id: ${authServerId}`);

    // Set cookies to maintain state
    res.cookie('state', state, cookieOptions);
    res.cookie('nonce', nonce, cookieOptions);
    res.cookie('code_verifier', code_verifier, cookieOptions);
    res.cookie('authorisation_server_id', authServerId, cookieOptions);

    // Log after setting cookies
    // console.log('--- Cookies have been set ---');
    // console.log('Cookies set for the response:', res.getHeaders()['set-cookie']); // Output the cookies being set

    // Return the auth URL to the client
    return res.json({ authUrl });
  } catch (error) {
    console.error('Error during PAR request:', error);
    return res.status(500).json({ error: 'Failed to send PAR request', details: error.message });
  }
});

export default router;
