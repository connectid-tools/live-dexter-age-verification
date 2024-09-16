import express from 'express';
import RelyingPartyClientSdk from '@connectid-tools/rp-nodejs-sdk';
import { config } from '../config.js';

const router = express.Router();
const rpClient = new RelyingPartyClientSdk(config);

// Define a list of valid claims for id_token
const validIdTokenClaims = [
  'auth_time',
  'over18',
  'given_name',
  'middle_name',
  'family_name',
  'phone_number',
  'email',
  'address',
  'birthdate',
  'txn'
];

// Helper function to validate and extract claims
const extractValidClaims = (claims, allowedClaims) => {
  return claims
    .map(claim => {
      if (typeof claim === 'string') {
        return claim.trim();
      }
      return null;
    })
    .filter(claim => claim && allowedClaims.includes(claim));
};

router.post('/select-bank', async (req, res) => {
  // Essential claims as objects
  const essentialClaimsObjects = {
    "auth_time": { "essential": true },
    "over18": { "essential": true }
  };

  // Convert essential claims to an array of strings
  const essentialClaimsArray = Object.keys(essentialClaimsObjects); // Array of strings: ['auth_time', 'over18']

  // Debugging: Log essentialClaimsArray to ensure it's correctly formatted
  console.log(`Essential Claims Array: ${JSON.stringify(essentialClaimsArray)}`);

  // Extract and validate voluntary claims from request body
  const voluntaryClaims = extractValidClaims(req.body.voluntaryClaims || [], validIdTokenClaims);

  // Log claims request for debugging
  console.log(`Voluntary Claims: ${JSON.stringify(voluntaryClaims)}`);

  const purpose = req.body.purpose || 'Age verification required';
  const authServerId = req.body.authorisationServerId;
  const cartId = req.body.cartId;

  if (!authServerId || !cartId) {
    const error = 'authorisationServerId and cartId are required';
    console.error(error);
    return res.status(400).json({ error });
  }

  try {
    // Send the pushed authorization request with the essential and voluntary claims
    const { authUrl, code_verifier, state, nonce, xFapiInteractionId } = await rpClient.sendPushedAuthorisationRequest(
      authServerId,
      essentialClaimsArray,  // Pass array of essential claims (strings)
      voluntaryClaims,       // Pass array of voluntary claims (strings)
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
