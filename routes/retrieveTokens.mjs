import express from 'express';
import RelyingPartyClientSdk from '@connectid-tools/rp-nodejs-sdk';
import { config } from '../config.js';
import { clearCookies } from '../utils/cookieUtils.mjs';
import { jwtDecode } from 'jwt-decode';

const router = express.Router();
const rpClient = new RelyingPartyClientSdk(config);

let tokenLogs = [];     // To store logs for the `/retrieve-tokens` response

router.get('/retrieve-tokens', async (req, res) => {
  console.log('--- /retrieve-tokens endpoint hit ---');

  // Extract the authorization code from query params
  const { code } = req.query;
  console.log(`Received code: ${code}`);

  // Validate that the authorization code is present
  if (!code) {
    console.error('Code parameter is missing');
    return res.status(400).json({ error: 'Code parameter is required' });
  }

  // Retrieve necessary cookies for token retrieval
  const { authorisation_server_id, code_verifier, state, nonce } = req.cookies;
  console.log('Cookies received:');
  console.log(`authorisation_server_id: ${authorisation_server_id}`);
  console.log(`code_verifier: ${code_verifier}`);
  console.log(`state: ${state}`);
  console.log(`nonce: ${nonce}`);

  // Check if any required cookie is missing
  if (!authorisation_server_id || !code_verifier || !state || !nonce) {
    console.error('Missing required cookies for token retrieval');
    return res.status(400).json({ error: 'Missing required cookies for token retrieval' });
  }

  try {
    console.log('Attempting to retrieve tokens with the following details:');
    console.log(`authorisation_server_id: ${authorisation_server_id}`);
    console.log(`code_verifier: ${code_verifier}`);
    console.log(`state: ${state}`);
    console.log(`nonce: ${nonce}`);

    // Call the rpClient's retrieveTokens method to exchange the code for tokens
    const tokenSet = await rpClient.retrieveTokens(
      authorisation_server_id, // Authorization server ID
      req.query,               // Contains the authorization code (i.e., code)
      code_verifier,           // Code verifier used in the PKCE flow
      state,                   // State to match the original request
      nonce                    // Nonce to match the original request
    );

    console.log('Tokens successfully retrieved');
    console.log('Full Token Set:', JSON.stringify(tokenSet, null, 2));

    // Extract the claims and tokens
    const claims = tokenSet.claims();
    const token = {
      decoded: JSON.stringify(jwtDecode(tokenSet.id_token), null, 2),
      raw: tokenSet.id_token,
    };

    console.log(`Returned claims: ${JSON.stringify(claims, null, 2)}`);
    console.log(`Returned raw id_token: ${token.raw}`);
    console.log(`Returned decoded id_token: ${token.decoded}`);
    console.log(`Returned xFapiInteractionId: ${tokenSet.xFapiInteractionId}`);

    console.log('Claims:', claims);
    console.log('ID Token (raw):', token.raw);
    console.log('ID Token (decoded):', token.decoded);

    // Clear previous logs to ensure fresh logs for every request
    tokenLogs = [];

    // Log the token retrieval success
    tokenLogs.push({
      type: 'Success',
      message: 'Tokens retrieved successfully',
      details: { claims, token },
      timestamp: new Date(),
    });

    // Perform additional checks and log errors or successes
    const expectedIssuer = "https://www.certification.openid.net/test/a/sheldonandhammond/";
    const expectedClientId = "https://rp.directory.sandbox.connectid.com.au/openid_relying_party/a849178a-f0a4-45ed-8472-a50c4d5299ae";
    const expectedAlgorithm = 'PS256'; // Expected algorithm for ID token signing

    // Test 1 - Check the `iss` value
    if (token.decoded.iss !== expectedIssuer) {
      tokenLogs.push({ type: 'Error', message: '`iss` value in id_token does not match expected issuer', timestamp: new Date() });
    }

    // Test 2 - Check the `aud` value
    if (token.decoded.aud !== expectedClientId) {
      tokenLogs.push({ type: 'Error', message: '`aud` value in id_token does not match expected client ID', timestamp: new Date() });
    }

    // Test 3 - Check the signing algorithm
    if (tokenSet.id_token_header?.alg !== expectedAlgorithm) {
      tokenLogs.push({ type: 'Error', message: `id_token algorithm ${tokenSet.id_token_header?.alg} does not match expected ${expectedAlgorithm}`, timestamp: new Date() });
    }

    // Test 4 - Check the expiration
    const currentTime = Math.floor(Date.now() / 1000); // Current time in seconds
    if (token.decoded.exp && token.decoded.exp < currentTime) {
      tokenLogs.push({ type: 'Error', message: '`exp` value in id_token has expired', timestamp: new Date() });
    }

    // More tests can be added here...

    // Clear cookies AFTER ensuring the tokens have been retrieved and no further actions need cookies
    clearCookies(res);
    console.log('Cookies cleared successfully');

    // Return the logs along with the claims and token info as a response
    console.log('Returning token, claims, and logs in the response');
    return res.json({ claims, token, logs: tokenLogs, xFapiInteractionId: tokenSet.xFapiInteractionId });
  } catch (error) {
    // Log the error in tokenLogs
    tokenLogs.push({
      type: 'Error',
      message: 'Error retrieving tokenset',
      details: error.toString(),
      timestamp: new Date(),
    });
    return res.status(500).json({ error: error.toString(), logs: tokenLogs });
  }
});

export default router;
