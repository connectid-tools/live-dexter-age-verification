import express from 'express';

const router = express.Router();

let tokenSetData = {};  // Global object to store token set and related data
let tokenLogs = [];     // Global array to store logs for /logs endpoint to return

// /logs endpoint
router.get('/logs', (req, res) => {
    console.log('--- /logs endpoint hit ---');
  
    // Access stored token data from global variables
    const { tokenSet, claims, token } = tokenSetData;
    
    const expectedIssuer = "https://www.certification.openid.net/test/a/sheldonandhammond/";
    const expectedClientId = "https://rp.directory.sandbox.connectid.com.au/openid_relying_party/a849178a-f0a4-45ed-8472-a50c4d5299ae";
    const expectedAlgorithm = 'PS256'; // Expected algorithm for ID token signing
  
    // Clear previous logs to ensure fresh logs for every request
    tokenLogs = [];
  
    // Check if token data is available
    if (!tokenSet || !claims || !token) {
      return res.status(400).json({ error: 'No token data found. Please retrieve tokens first by hitting /retrieve-tokens.' });
    }

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

    // Return the collected logs as a JSON response
    return res.json({ logs: tokenLogs });
});

export default router;
