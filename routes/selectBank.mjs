import express from 'express';
import RelyingPartyClientSdk from '@connectid-tools/rp-nodejs-sdk';
import { config } from '../config.js';

const router = express.Router();
const rpClient = new RelyingPartyClientSdk(config);

// Define a list of valid essential claims for id_token
const essentialClaimsList = [
  'auth_time',
  'given_name',
  'family_name',
  'phone_number',
  'email',
  'address',
  'birthdate',
  'txn'
];

// Define voluntary claims (including over18)
const voluntaryClaimsList = [
  'over18'
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
  // Essential claims
  const essentialClaims = essentialClaimsList;  // List of essential claims from the spec

  // Extract and validate voluntary claims (e.g., over18)
  const voluntaryClaims = extractValidClaims(req.body.voluntaryClaims || voluntaryClaimsList, voluntaryClaimsList);

  // // Define verified claims for the request (without bank account details)
  // const verifiedClaims = {
  //   verification: {
  //     trust_framework: 'au_connectid' // Specify trust framework for the verification
  //   },
  //   claims: {
  //     over18: true // Example of verified claim
  //   }
  // };

  const purpose = req.body.purpose || 'Age verification';
  const authServerId = req.body.authorisationServerId;
  const cartId = req.body.cartId;

  if (!authServerId || !cartId) {
    const error = 'authorisationServerId and cartId are required';
    console.error(error);
    return res.status(400).json({ error });
  }

  try {
    // Send the pushed authorization request with the essential, voluntary, and verified claims
    const { authUrl, code_verifier, state, nonce, xFapiInteractionId } = await rpClient.sendPushedAuthorisationRequest(
      authServerId,
      essentialClaims,  // Pass array of essential claims (strings)
      voluntaryClaims,   // Pass array of voluntary claims (strings)
      purpose
    );

    // Set cookies to be used later during token retrieval
    const cookieOptions = {
      path: '/',
      sameSite: 'None',
      secure: true,
      httpOnly: true,
      maxAge: 3 * 60 * 1000
    };

    // Store relevant details in cookies for later retrieval
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
