import dotenv from 'dotenv';
dotenv.config();

import express from 'express';
import path from 'path';
import logger from 'morgan';
import cors from 'cors';
import RelyingPartyClientSdk from '@connectid-tools/rp-nodejs-sdk';
import { config } from './config.js';
export const tokenStore = new Map(); // Token store to keep track of tokens and their expiration

const rpClient = new RelyingPartyClientSdk(config);

// Import routes
import indexRouter from './routes/index.mjs';
import validateCartRouter from './routes/restrictItems.mjs';
import getRestrictedItemsRouter from './routes/getRestrictedItems.mjs';

const app = express();
const port = 3001;

// CORS configuration
const storeDomain = process.env.STORE_DOMAIN;
app.use(cors({
  origin: [`https://${storeDomain}`],  // Your BigCommerce store domain
  methods: ['GET', 'POST'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true,  // Enable credentials
}));

// Set Access-Control-Allow-Credentials in the response headers
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  next();
});

// Middleware setup
app.use(logger('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(express.static(path.join(path.resolve(), 'public')));

app.use('/', indexRouter);
app.use('/validate-cart', validateCartRouter);
app.use('/restricted-items', getRestrictedItemsRouter);

// Token management
function generateAndStoreToken(cartId) {
  const token = Math.random().toString(36).substring(2);
  const expiresAt = Date.now() + 60 * 60 * 1000;  // Token expiration set to 1 hour
  tokenStore.set(cartId, { token, expiresAt });
  console.log(`Token for cartId ${cartId} generated. Expires at ${new Date(expiresAt).toISOString()}. Token: ${token}`);
  return token;
}

function clearExpiredTokens() {
  const now = Date.now();
  tokenStore.forEach((tokenData, cartId) => {
    if (tokenData.expiresAt < now) {
      tokenStore.delete(cartId);
      console.log(`Expired token for cartId ${cartId} removed.`);
    }
  });
}

setInterval(clearExpiredTokens, 5 * 60 * 1000);  // Clear expired tokens every 5 minutes

app.post('/select-bank', async (req, res) => {
  const essentialClaims = ['over18']; // Only requesting the over18 claim
  const voluntaryClaims = [];
  const purpose = req.body.purpose || 'Age verification required'; // Default purpose if not provided
  const authServerId = req.body.authorisationServerId;
  const cartId = req.body.cartId;

  // Validate that both the authorisationServerId and cartId are provided
  if (!authServerId || !cartId) {
    return res.status(400).json({ error: 'authorisationServerId and cartId are required' });
  }

  try {
    console.log(`Processing request to send PAR with authorisationServerId='${authServerId}', essentialClaim='over18', cartId='${cartId}'`);

    // Send the Pushed Authorization Request (PAR) to the authorization server
    const { authUrl, code_verifier, state, nonce, xFapiInteractionId } = await rpClient.sendPushedAuthorisationRequest(
      authServerId,
      essentialClaims,
      voluntaryClaims,
      purpose
    );

    // Set cookies for state, nonce, and code_verifier to maintain session integrity
    const cookieOptions = {
      path: '/',
      sameSite: 'None',  // Required for cross-origin requests
      secure: true,      // Cookies must be secure (HTTPS)
      httpOnly: true,    // Prevent JavaScript from accessing cookies
      maxAge: 10 * 60 * 1000 // 10 minutes
    };

    res.cookie('state', state, cookieOptions);
    res.cookie('nonce', nonce, cookieOptions);
    res.cookie('code_verifier', code_verifier, cookieOptions);
    res.cookie('authorisation_server_id', authServerId, cookieOptions);

    console.log(`PAR sent to authorisationServerId='${authServerId}', returning authUrl='${authUrl}'`);

    // Return the authorization URL back to the frontend
    return res.json({ authUrl });
  } catch (error) {
    console.error('Error during PAR request:', error);
    return res.status(500).json({ error: 'Failed to send PAR request', details: error.message });
  }
});
app.get('/retrieve-tokens', async (req, res) => {
  const cartId = req.query.cartId;
  const code = req.query.code;

  if (!code || !cartId) {
    return res.status(400).json({ error: 'Code parameter and cartId are required' });
  }

  // Check if required cookies are present
  if (!req.cookies.authorisation_server_id || !req.cookies.code_verifier || !req.cookies.state || !req.cookies.nonce) {
    return res.status(400).json({ error: 'Missing required cookies for token exchange.' });
  }

  try {
    console.log(`Attempting to retrieve tokens for cartId: ${cartId}`);

    // Call the SDK to retrieve tokens
    const tokenSet = await rpClient.retrieveTokens(
      req.cookies.authorisation_server_id,
      { code },  // The code returned from the bank
      req.cookies.code_verifier,
      req.cookies.state,
      req.cookies.nonce
    );

    console.log('TokenSet received:', tokenSet);

    const claims = tokenSet.claims(); // Extract claims from the token set
    console.log('Claims extracted:', claims);

    // Verify if the user has met the required claims (e.g., 'over18')
    if (claims.over18 && claims.over18 === true) {
      // Generate and store the session token only after successful verification
      const token = generateAndStoreToken(cartId); 
      console.log(`Verification successful for cartId ${cartId}. Token generated: ${token}`);

      return res.json({ claims, token, xFapiInteractionId: tokenSet.xFapiInteractionId });
    } else {
      console.log('User verification failed: Age requirement not met');
      return res.status(400).json({ error: 'User verification failed. Age requirement not met.' });
    }
  } catch (error) {
    // Log the full error details
    console.error('Error retrieving tokens:', error.message);
    return res.status(500).json({ error: 'Failed to retrieve tokens', details: error.message });
  }
});


// Catch 404 and error handler
app.use(function(req, res, next) {
  next(createError(404));
});

app.use(function(err, req, res, next) {
  res.locals.message = err.message;
  res.locals.error = req.app.get('env') === 'development' ? err : {};
  res.status(err.status || 500).json({ error: err.message });
});

// Start server
app.listen(port, () => {
  console.log(`Server listening on port ${port}`);
});

export default app;
