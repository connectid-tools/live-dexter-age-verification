import express from 'express';
import { config } from '../config.js';
import RelyingPartyClientSdk from '@connectid-tools/rp-nodejs-sdk';
import { generateAndStoreToken } from '../utils/tokenManager.js'; // Assuming you store tokens
import { validateClaims } from '../utils/validation.js'; // For custom validation functions


const router = express.Router();
const rpClient = new RelyingPartyClientSdk(config);

router.post('/select-bank', async (req, res) => {
  const purpose = 'Age verification required'; // Default purpose
  const authServerId = req.body.authorisationServerId;  // Fetching the authorization server ID
  const cartId = req.body.cartId;  // Fetching the cart ID

  // Validate that both the authorizationServerId and cartId are provided
  if (!authServerId || !cartId) {
    return res.status(400).json({ error: 'authorisationServerId and cartId are required' });
  }

  // Define the essential claims to check if the user is over 18
  const essentialClaims = {
    "id_token": {
      "auth_time": { "essential": true },  // Standard OpenID claim
      "over18": { "essential": true }  // Custom claim to check if the user is over 18
    }
  };

  // Log essential claims
  console.log(`Essential claims: ${JSON.stringify(essentialClaims)}`);

  // Ensure it is properly passed as part of your authorization request
  const essentialClaimsArray = [essentialClaims];

  try {
    // Log the essentialClaimsArray to verify its structure
    console.log(`Essential Claims Array: ${JSON.stringify(essentialClaimsArray)}`);

    // Send the pushed authorization request with the updated claim
    const { authUrl, code_verifier, state, nonce, xFapiInteractionId } = await rpClient.sendPushedAuthorisationRequest(
      authServerId, 
      essentialClaimsArray,  // Use the array version of essentialClaims
      [],  
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