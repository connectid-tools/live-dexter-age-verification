import express from 'express';
import RelyingPartyClientSdk from '@connectid-tools/rp-nodejs-sdk';
import { config } from '../config.js';
import { clearCookies } from '../utils/cookieUtils.mjs';
import { jwtDecode } from 'jwt-decode';

const router = express.Router();
const rpClient = new RelyingPartyClientSdk(config);

let tokenLogs = []; // To store logs for the `/retrieve-tokens` response

router.get('/retrieve-tokens', async (req, res) => {
  console.log('--- /retrieve-tokens endpoint hit ---');

  let loggedError = false; // Flag to track if an error has already been logged
  let loggedSuccess = false; // To track if success has been logged

  // Extract the authorization code from query params
  const { code } = req.query;
  console.log(`Received code: ${code}`);

  // Validate that the authorization code is present
  if (!code) {
    return res.status(400).json({ error: 'Code parameter is required' });
  }

  // Retrieve necessary cookies for token retrieval
  const { authorisation_server_id, code_verifier, state, nonce } = req.cookies;

  if (!authorisation_server_id || !code_verifier || !state || !nonce) {
    return res.status(400).json({ error: 'Missing required cookies for token retrieval' });
  }

  try {
    const tokenSet = await rpClient.retrieveTokens(
      authorisation_server_id,
      req.query,
      code_verifier,
      state,
      nonce
    );

    const claims = tokenSet.claims();
    const token = {
      decoded: jwtDecode(tokenSet.id_token),
      raw: tokenSet.id_token,
    };

    tokenLogs = []; // Clear previous logs

    const expectedIssuer = "https://www.certification.openid.net/test/a/sheldonandhammond/";
    const expectedClientId = "https://rp.directory.sandbox.connectid.com.au/openid_relying_party/a849178a-f0a4-45ed-8472-a50c4d5299ae";
    const expectedAlgorithm = 'PS256';

    // Test 1 - Happy path flow with tokens retrieved
    // if (!loggedError && !loggedSuccess) {
    //   tokenLogs.push({
    //     type: 'Success',
    //     message: 'Success: Happy path flow completed, tokens retrieved',
    //     timestamp: new Date()
    //   });
    //   loggedSuccess = true;
    //   return res.status(200).json({ message: 'Success: Happy path flow completed, tokens retrieved', logs: tokenLogs });
    // }
    
    // Test 2 - Mismatched `iss` value
    console.log('Checking `iss` value:', token.decoded.iss, 'against expected issuer:', expectedIssuer);

    if (token.decoded.iss !== expectedIssuer) {
      console.log('Mismatched `iss` value detected'); // Log that the mismatch was detected
      tokenLogs.push({ 
        type: 'Error', 
        message: '`iss` value in id_token does not match expected issuer', 
        details: `Received: ${token.decoded.iss}, Expected: ${expectedIssuer}`,
        timestamp: new Date() 
      });
      loggedError = true;
      return res.status(400).json({ error: 'The iss value in the id_token does not match the authorization server\'s issuer', logs: tokenLogs });
    }

    // Test 3 - Mismatched `aud` value
    if (!loggedError && token.decoded.aud !== expectedClientId) {
      tokenLogs.push({ 
        type: 'Error', 
        message: '`aud` value in id_token does not match expected client ID', 
        details: `Received: ${token.decoded.aud}, Expected: ${expectedClientId}`,
        timestamp: new Date() 
      });
      loggedError = true;
      return res.status(400).json({ error: 'The aud value in the id_token does not match the expected client ID', logs: tokenLogs });
    }

    if (!loggedError && Array.isArray(token.decoded.aud) && token.decoded.aud.length === 1 && token.decoded.aud[0] === expectedClientId) {
      tokenLogs.push({
        type: 'Success',
        message: '`aud` is an array with one valid value',
        timestamp: new Date()
      });
      loggedSuccess = true;
    }



    // Test 5 - `alg: none`
    if (!loggedError && tokenSet.id_token_header?.alg === 'none') {
      tokenLogs.push({ 
        type: 'Error', 
        message: '`id_token` was signed with `alg: none`', 
        timestamp: new Date() 
      });
      loggedError = true;
      return res.status(400).json({ error: 'The id_token was signed with alg: none', logs: tokenLogs });
    }

    // Function to check the signing algorithm
    function checkSigningAlgorithm(tokenSet, expectedAlgorithm) {
      console.log('Checking `alg` value:', tokenSet.id_token_header?.alg, 'against expected algorithm:', expectedAlgorithm);
    }
    checkSigningAlgorithm(tokenSet, expectedAlgorithm);

    // Test 6 - Mismatched signing algorithm
    if (!loggedError && tokenSet.id_token_header?.alg !== expectedAlgorithm) {
      tokenLogs.push({ 
        type: 'Error', 
        message: `id_token algorithm ${tokenSet.id_token_header?.alg} does not match expected ${expectedAlgorithm}`, 
        timestamp: new Date() 
      });
      loggedError = true;
      return res.status(400).json({ error: 'The id_token algorithm does not match the expected algorithm', logs: tokenLogs });
    }

    // Test 7 - Expired `exp` value
    if (!loggedError && token.decoded.exp && token.decoded.exp < Math.floor(Date.now() / 1000)) {
      tokenLogs.push({ 
        type: 'Error', 
        message: '`exp` value in id_token has expired', 
        timestamp: new Date() 
      });
      loggedError = true;
      return res.status(400).json({ error: 'The exp value in the id_token has expired', logs: tokenLogs });
    }

    // Test 8 - Missing `exp` value
    if (!loggedError && !token.decoded.exp) {
      tokenLogs.push({ 
        type: 'Error', 
        message: '`exp` value is missing in id_token', 
        timestamp: new Date() 
      });
      loggedError = true;
      return res.status(400).json({ error: 'The exp value is missing in the id_token', logs: tokenLogs });
    }

    // Test 9 - Missing `aud` value
    if (!loggedError && !token.decoded.aud) {
      tokenLogs.push({ 
        type: 'Error', 
        message: '`aud` value is missing in id_token', 
        timestamp: new Date() 
      });
      loggedError = true;
      return res.status(400).json({ error: 'The aud value is missing in the id_token', logs: tokenLogs });
    }

    // Test 10 - Missing `iss` value
    if (!loggedError && !token.decoded.iss) {
      tokenLogs.push({ 
        type: 'Error', 
        message: '`iss` value is missing in id_token', 
        timestamp: new Date() 
      });
      loggedError = true;
      return res.status(400).json({ error: 'The iss value is missing in the id_token', logs: tokenLogs });
    }

    // Test 11 - `aud` is an array with one valid value
    if (!loggedError && Array.isArray(token.decoded.aud) && token.decoded.aud.length === 1 && token.decoded.aud[0] === expectedClientId) {
      tokenLogs.push({ 
        type: 'Success', 
        message: '`aud` is an array with one valid value', 
        timestamp: new Date() 
      });
      loggedSuccess = true;
    }

    // Test 12 - Mismatched `nonce`
    if (!loggedError && token.decoded.nonce !== tokenSet.nonce) {
      tokenLogs.push({ 
        type: 'Error', 
        message: '`nonce` value in id_token does not match the request nonce', 
        timestamp: new Date() 
      });
      loggedError = true;
      return res.status(400).json({ error: 'The nonce value in the id_token does not match the request nonce', logs: tokenLogs });
    }

    // Test 13 - Missing `nonce`
    if (!loggedError && !token.decoded.nonce && tokenSet.nonce) {
      tokenLogs.push({ 
        type: 'Error', 
        message: '`nonce` value is missing in id_token but was expected', 
        timestamp: new Date() 
      });
      loggedError = true;
      return res.status(400).json({ error: 'The nonce value is missing in the id_token but was expected', logs: tokenLogs });
    }

    // Test 14 - Invalid issuer in the token
    if (!loggedError && token.decoded.iss !== expectedIssuer) {
      tokenLogs.push({ 
        type: 'Error', 
        message: 'Invalid issuer in id_token from token_endpoint', 
        timestamp: new Date() 
      });
      loggedError = true;
      return res.status(400).json({ error: 'The issuer in the id_token from the token endpoint is invalid', logs: tokenLogs });
    }

    // Test 15 - Missing issuer in authorization response
    if (!loggedError && !token.decoded.iss) {
      tokenLogs.push({ 
        type: 'Error', 
        message: '`iss` is missing in the authorization response', 
        timestamp: new Date() 
      });
      loggedError = true;
      return res.status(400).json({ error: 'The iss value is missing in the authorization response', logs: tokenLogs });
    }

    // Test 16 - Invalid `state` value
    if (!loggedError && req.query.state && req.query.state !== tokenSet.state) {
      tokenLogs.push({ 
        type: 'Error', 
        message: 'Invalid `state` value in authorization endpoint response', 
        timestamp: new Date() 
      });
      loggedError = true;
      return res.status(400).json({ error: 'The state value in the authorization endpoint response is invalid', logs: tokenLogs });
    }

    // Test 17 - Invalid or Missing `state` value
    if (!loggedError && !req.query.state) {
      tokenLogs.push({ 
        type: 'Skipped', 
        message: 'No `state` value provided in authorization endpoint response', 
        timestamp: new Date() 
      });
    } else if (!loggedError && req.query.state !== tokenSet.state) {
      tokenLogs.push({ 
        type: 'Error', 
        message: 'Invalid `state` value in authorization endpoint response', 
        timestamp: new Date() 
      });
      loggedError = true;
      return res.status(400).json({ error: 'The state value in the authorization endpoint response is invalid', logs: tokenLogs });
    }

    // Test 18 - Happy path flow and resource access
    if (!loggedError && tokenSet && true /* assuming resource request successful */) {
      tokenLogs.push({
        type: 'Success',
        message: 'Happy path flow completed, tokens retrieved and resource endpoint accessed successfully',
        timestamp: new Date()
      });
      loggedSuccess = true;
    }

    // If no errors, clear cookies and return successful response
    if (loggedSuccess) {
      clearCookies(res);
      console.log('Cookies cleared successfully');
      
      return res.json({ claims, token, logs: tokenLogs, xFapiInteractionId: tokenSet.xFapiInteractionId });
    }

    } catch (error) {
      // If a specific token error (e.g., `iss` or `aud` mismatch) has been logged, just return those logs
      if (loggedError) {
        return res.status(400).json({ error: 'Specific token error occurred', logs: tokenLogs });
      }

      // No generic error logging
    }

    
});

export default router;
