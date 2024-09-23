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
      decoded: jwtDecode(tokenSet.id_token),
      raw: tokenSet.id_token,
    };

    console.log(`Returned claims: ${JSON.stringify(claims, null, 2)}`);
    console.log(`Returned raw id_token: ${token.raw}`);
    console.log(`Returned decoded id_token: ${JSON.stringify(token.decoded, null, 2)}`);
    console.log(`Returned xFapiInteractionId: ${tokenSet.xFapiInteractionId}`);

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

   // Test 1 - Happy path flow with tokens retrieved
   const successMessage = 'Success: Happy path flow completed, tokens retrieved';
   tokenLogs.push({ type: 'Success', message: successMessage, timestamp: new Date() });

   // Test 2 - Mismatched `iss` value
   if (token.decoded.iss !== expectedIssuer) {
     tokenLogs.push({ type: 'Error', message: '`iss` value in id_token does not match expected issuer', timestamp: new Date() });
   }

   // Test 3 - Mismatched `aud` value
   if (token.decoded.aud !== expectedClientId) {
     tokenLogs.push({ type: 'Error', message: '`aud` value in id_token does not match expected client ID', timestamp: new Date() });
   }

   // Test 4 - `aud` array with additional untrusted client_id and missing `azp`
   if (Array.isArray(token.decoded.aud) && !token.decoded.azp) {
     tokenLogs.push({ type: 'Error', message: '`aud` contains multiple clients and `azp` claim is missing', timestamp: new Date() });
   }

   // Test 5 - `alg: none`
   if (tokenSet.id_token_header?.alg === 'none') {
     tokenLogs.push({ type: 'Error', message: '`id_token` was signed with `alg: none`', timestamp: new Date() });
   }

   // Test 6 - Mismatched signing algorithm
   if (tokenSet.id_token_header?.alg !== expectedAlgorithm) {
     tokenLogs.push({ type: 'Error', message: `id_token algorithm ${tokenSet.id_token_header?.alg} does not match expected ${expectedAlgorithm}`, timestamp: new Date() });
   }

   // Test 7 - Expired `exp` value
   const currentTime = Math.floor(Date.now() / 1000); // Current time in seconds
   if (token.decoded.exp && token.decoded.exp < currentTime) {
     tokenLogs.push({ type: 'Error', message: '`exp` value in id_token has expired', timestamp: new Date() });
   }

   // Test 8 - Missing `exp` value
   if (!token.decoded.exp) {
     tokenLogs.push({ type: 'Error', message: '`exp` value is missing in id_token', timestamp: new Date() });
   }

   // Test 9 - Missing `aud` value
   if (!token.decoded.aud) {
     tokenLogs.push({ type: 'Error', message: '`aud` value is missing in id_token', timestamp: new Date() });
   }

   // Test 10 - Missing `iss` value
   if (!token.decoded.iss) {
     tokenLogs.push({ type: 'Error', message: '`iss` value is missing in id_token', timestamp: new Date() });
   }

   // Test 11 - `aud` is an array with one valid value
   if (Array.isArray(token.decoded.aud) && token.decoded.aud.length === 1 && token.decoded.aud[0] === expectedClientId) {
     tokenLogs.push({ type: 'Success', message: '`aud` is an array with one valid value', timestamp: new Date() });
   }

   // Test 12 - Mismatched `nonce`
   if (token.decoded.nonce !== tokenSet.nonce) {
     tokenLogs.push({ type: 'Error', message: '`nonce` value in id_token does not match the request nonce', timestamp: new Date() });
   }

   // Test 13 - Missing `nonce`
   if (!token.decoded.nonce && tokenSet.nonce) {
     tokenLogs.push({ type: 'Error', message: '`nonce` value is missing in id_token but was expected', timestamp: new Date() });
   }

   // Test 14 - Invalid issuer in the token
   if (token.decoded.iss !== expectedIssuer) {
     tokenLogs.push({ type: 'Error', message: 'Invalid issuer in id_token from token_endpoint', timestamp: new Date() });
   }

   // Test 15 - Missing issuer in authorization response
   if (!token.decoded.iss) {
     tokenLogs.push({ type: 'Error', message: '`iss` is missing in the authorization response', timestamp: new Date() });
   }

   // Test 16 - Invalid `state` value
   if (req.query.state && req.query.state !== tokenSet.state) {
     tokenLogs.push({ type: 'Error', message: 'Invalid `state` value in authorization endpoint response', timestamp: new Date() });
   }

   // Test 17 - Invalid or Missing `state` value
   if (!req.query.state) {
     tokenLogs.push({ type: 'Skipped', message: 'No `state` value provided in authorization endpoint response', timestamp: new Date() });
   } else if (req.query.state !== tokenSet.state) {
     tokenLogs.push({ type: 'Error', message: 'Invalid `state` value in authorization endpoint response', timestamp: new Date() });
   }

   // Test 18 - Happy path flow and resource access
   const resourceRequestSuccessful = true; // Assuming this is calculated elsewhere
   if (tokenSet && resourceRequestSuccessful) {
     tokenLogs.push({ type: 'Success', message: 'Happy path flow completed, tokens retrieved and resource endpoint accessed successfully', timestamp: new Date() });
   }

   // Test 19 - Case-sensitive `token_type` issue
   if (tokenSet.token_type !== 'Bearer') {
     tokenLogs.push({ type: 'Error', message: 'Case-sensitive mismatch in `token_type` returned from token endpoint', timestamp: new Date() });
   }

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
