import express from 'express';
import { config } from '../config.js';
import RelyingPartyClientSdk from '@connectid-tools/rp-nodejs-sdk';

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

  // Define the essential claims for the ID Token
  const essentialClaims = {
    "id_token": {
      "iss": { "essential": true },  // Issuer Identifier
      "sub": { "essential": true },  // Subject Identifier
      "aud": { "essential": true },  // Audience
      "exp": { "essential": true },  // Expiration time
      "iat": { "essential": true },  // Issued at time
      "auth_time": { "essential": true },  // Authentication time
      "nonce": { "essential": true }  // Nonce
    }
  };

  try {
    console.log(`Processing request to send PAR with authorisationServerId='${authServerId}', essentialClaims=${JSON.stringify(essentialClaims)}, cartId='${cartId}'`);

    // Ensure essentialClaims is an array
    const essentialClaimsArray = [essentialClaims];

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