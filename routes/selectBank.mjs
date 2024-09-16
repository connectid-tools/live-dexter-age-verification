import express from 'express';
import RelyingPartyClientSdk from '@connectid-tools/rp-nodejs-sdk';
import { config } from '../config.js';

const router = express.Router();
const rpClient = new RelyingPartyClientSdk(config);

router.post('/select-bank', async (req, res) => {
  // Extract essential claims from request body and convert to array of strings
  const essentialClaimsObjects = [
    { "claim": "auth_time", "essential": true },
    { "claim": "over18", "essential": true }
  ];

  const essentialClaims = essentialClaimsObjects
    .filter(claim => claim.essential) // Only include claims marked as essential
    .map(claim => claim.claim); // Convert to array of strings

  // Extract and format voluntary claims from request body
  const voluntaryClaimsObjects = (req.body.voluntaryClaims || []).map(claim => {
    if (typeof claim === 'string') {
      return { "claim": claim, "essential": false };
    } else if (typeof claim === 'object' && claim.claim) {
      return {
        "claim": String(claim.claim),
        "essential": Boolean(claim.essential)
      };
    }
    return { "claim": "", "essential": false };
  });

  const voluntaryClaims = voluntaryClaimsObjects
    .filter(claim => !claim.essential) // Only include non-essential claims
    .map(claim => claim.claim); // Convert to array of strings

  // Log formatted claims for debugging
  console.log(`Formatted Essential Claims: ${JSON.stringify(essentialClaims)}`);
  console.log(`Formatted Voluntary Claims: ${JSON.stringify(voluntaryClaims)}`);

  const purpose = req.body.purpose || 'Age verification required'; // Default purpose
  const authServerId = req.body.authorisationServerId;
  const cartId = req.body.cartId;

  // Validate that both the authorizationServerId and cartId are provided
  if (!authServerId || !cartId) {
    const error = 'authorisationServerId and cartId are required';
    console.error(error);
    return res.status(400).json({ error });
  }

  try {
    // Send the pushed authorization request with the claims
    const { authUrl, code_verifier, state, nonce, xFapiInteractionId } = await rpClient.sendPushedAuthorisationRequest(
      authServerId,
      essentialClaims,  // Must provide essentialClaims as an array of strings
      voluntaryClaims,  // Optional: array of strings
      purpose           // Optional: purpose string
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
