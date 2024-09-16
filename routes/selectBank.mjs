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
        return { claim, essential: false };
      } else if (typeof claim === 'object' && claim.claim) {
        return { claim: claim.claim, essential: claim.essential || false };
      }
      return null;
    })
    .filter(claim => claim && allowedClaims.includes(claim.claim) && claim.claim.trim() !== '');
};

router.post('/select-bank', async (req, res) => {
  // Essential claims as objects
  const essentialClaimsObjects = {
    "auth_time": { "essential": true },
    "over18": { "essential": true }
  };

  // Extract and validate essential claims
  const essentialClaimsArray = Object.keys(essentialClaimsObjects).map(key => ({
    claim: key,
    essential: essentialClaimsObjects[key].essential
  }));

  const essentialClaims = extractValidClaims(essentialClaimsArray, validIdTokenClaims);

  // Ensure essentialClaims is an array of strings
  const essentialClaimsStringArray = essentialClaims
    .filter(({ claim }) => typeof claim === 'string' && claim.trim() !== '')
    .map(({ claim }) => claim);

  // Debugging: Log essentialClaims
  console.log(`Essential Claims: ${JSON.stringify(essentialClaimsStringArray)}`);

  // Extract and validate voluntary claims from request body
  const voluntaryClaims = extractValidClaims(req.body.voluntaryClaims || [], validIdTokenClaims);

  // Construct claims request
  const claimsRequest = {
    id_token: essentialClaimsStringArray.reduce((acc, claim) => {
      acc[claim] = { essential: true }; // Essential claims are always true
      return acc;
    }, {}),
    userinfo: voluntaryClaims.reduce((acc, { claim, essential }) => {
      acc[claim] = { essential };
      return acc;
    }, {})
  };

  console.log(`Claims Request: ${JSON.stringify(claimsRequest)}`);

  const purpose = req.body.purpose || 'Age verification required';
  const authServerId = req.body.authorisationServerId;
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
      claimsRequest,
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
