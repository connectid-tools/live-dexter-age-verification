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

// Define allowed origins (both the BigCommerce store and the DigitalOcean app)
const allowedOrigins = [
  'https://connectid-demo-k3.mybigcommerce.com',
  'https://sh-checkout-validator-qud6t.ondigitalocean.app'
];

// Set up CORS for all routes
app.use(cors({
  origin: function (origin, callback) {
    // Allow the request if the origin is in the allowedOrigins list or no origin (server-side requests)
    if (allowedOrigins.indexOf(origin) !== -1 || !origin) {
      callback(null, true);  // Allow the request
    } else {
      callback(new Error('Not allowed by CORS'));  // Block the request
    }
  },
  methods: ['GET', 'POST', 'OPTIONS'],  // Allow GET, POST, and OPTIONS methods
  allowedHeaders: ['Content-Type', 'Authorization'],  // Allow specific headers
  credentials: true  // Enable credentials (cookies)
}));

// Set additional CORS headers globally if needed for specific cases
app.use((req, res, next) => {
  // The cors middleware already sets the necessary headers, no need to set them manually here.
  // If you need to add custom headers, you can do so, but avoid overriding CORS headers set by cors middleware.
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
  const authServerId = req.body.authorisationServerId;  // Fetching the authorization server ID
  const cartId = req.body.cartId;  // Fetching the cart ID

  // Validate that both the authorizationServerId and cartId are provided
  if (!authServerId || !cartId) {
    // Return a 400 error if the necessary IDs are missing
    return res.status(400).json({ error: 'authorisationServerId and cartId are required' });
  }

  try {
    // Log the beginning of the PAR request process for debugging
    console.log(`Processing request to send PAR with authorisationServerId='${authServerId}', essentialClaim='over18', cartId='${cartId}'`);

    // Send the Pushed Authorization Request (PAR) to the authorization server
    const { authUrl, code_verifier, state, nonce, xFapiInteractionId } = await rpClient.sendPushedAuthorisationRequest(
      authServerId,
      essentialClaims,
      voluntaryClaims,
      purpose
    );

    // Define cookie options with necessary attributes for cross-origin requests
    const cookieOptions = {
      path: '/',              // Set the path to root so the cookie is available site-wide
      sameSite: 'None',       // Required for cross-origin requests (i.e., frontend and backend on different domains)
      secure: true,           // Cookies must be sent over HTTPS
      httpOnly: true,         // Prevent JavaScript from accessing cookies for security
      maxAge: 10 * 60 * 1000  // Cookies expire after 10 minutes
    };

    // Set cookies for state, nonce, and code_verifier to maintain session integrity
    res.cookie('state', state, cookieOptions);
    res.cookie('nonce', nonce, cookieOptions);
    res.cookie('code_verifier', code_verifier, cookieOptions);
    res.cookie('authorisation_server_id', authServerId, cookieOptions);

    // Log successful sending of the PAR request and returning the authorization URL
    console.log(`PAR sent to authorisationServerId='${authServerId}', returning authUrl='${authUrl}'`);

    // Return the authorization URL back to the frontend
    return res.json({ authUrl });
  } catch (error) {
    // Log any error that occurs during the PAR request process
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

  // Check if the required cookies are present
  const authorisationServerId = req.cookies.authorisation_server_id;
  const codeVerifier = req.cookies.code_verifier;
  const state = req.cookies.state;
  const nonce = req.cookies.nonce;

  if (!authorisationServerId || !codeVerifier || !state || !nonce) {
    console.error('Missing one or more required cookies:', {
      authorisationServerId,
      codeVerifier,
      state,
      nonce
    });
    return res.status(400).json({ error: 'Missing required cookies for token exchange.' });
  }

  try {
    console.log(`Attempting to retrieve tokens for cartId: ${cartId}`);

    // Retrieve tokens using the OIDC flow
    const tokenSet = await rpClient.retrieveTokens(
      authorisationServerId,
      { code },  // The code returned from the bank
      codeVerifier,
      state,
      nonce
    );

    console.log('TokenSet received:', tokenSet);

    const claims = tokenSet.claims();
    console.log('Claims extracted:', claims);

    // Verify if the user has met the required claims (e.g., 'over18')
    if (claims.over18 && claims.over18 === true) {
      const token = generateAndStoreToken(cartId); 
      console.log(`Verification successful for cartId ${cartId}. Token generated: ${token}`);

      return res.json({ claims, token, xFapiInteractionId: tokenSet.xFapiInteractionId });
    } else {
      console.log('User verification failed: Age requirement not met');
      return res.status(400).json({ error: 'User verification failed. Age requirement not met.' });
    }
  } catch (error) {
    console.error('Error retrieving tokens:', error);
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
