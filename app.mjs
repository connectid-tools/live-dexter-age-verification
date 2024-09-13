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
const storeDomain = process.env.STORE_DOMAIN;
const endpointDomain = process.env.ENDPOINT_DOMAIN;

// Define allowed origins (both the BigCommerce store and the DigitalOcean app)
const allowedOrigins = [
`https://${storeDomain}`,  // BigCommerce Store Domain
  `https://${endpointDomain}.ondigitalocean.app`
];

// Set up CORS for all routes
app.use(cors({
  origin: function (origin, callback) {
    if (allowedOrigins.indexOf(origin) !== -1 || !origin) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  methods: ['GET', 'POST', 'OPTIONS'],  // Allow specific methods
  allowedHeaders: ['Content-Type', 'Authorization'],  // Allow specific headers
  credentials: true  // Enable credentials (cookies)
}));

// Add OPTIONS route to handle preflight requests globally for all routes
app.options('*', cors());

// Set additional CORS headers globally if needed for specific cases
app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (allowedOrigins.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  }
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  next();
});

// Other route and middleware configurations below


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
  const expiresAt = Date.now() + 3 * 60 * 1000;  // Token expiration set to 1 hour
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
  const purpose = 'Age verification required'; // Default purpose if not provided
  const authServerId = req.body.authorisationServerId;  // Fetching the authorization server ID
  const cartId = req.body.cartId;  // Fetching the cart ID

  // Validate that both the authorizationServerId and cartId are provided
  if (!authServerId || !cartId) {
    return res.status(400).json({ error: 'authorisationServerId and cartId are required' });
  }

  // Original object structure for essential claims
  const essentialClaimsObject = {
    id_token: {
      over18: { essential: true }  // Requesting 'over18' as an essential claim in the ID token
    }
  };

   // Translate the object into an array of keys where 'essential' is true
   const essentialClaims = Object.keys(essentialClaimsObject.id_token).map(
    (claim) => claim  // Get only the claim names (in this case, "over18")
  );

  try {
    console.log(`Processing request to send PAR with authorisationServerId='${authServerId}', essentialClaim='over18', cartId='${cartId}'`);
    console.log("Claims being sent:", essentialClaims);

    // Send the Pushed Authorization Request (PAR) to the authorization server
    const { authUrl, code_verifier, state, nonce, xFapiInteractionId } = await rpClient.sendPushedAuthorisationRequest(
      authServerId,
      essentialClaims,  // Send the claims object directly
      [],  // No voluntary claims in this case
      purpose
    );

    // Define cookie options with necessary attributes for cross-origin requests
    const cookieOptions = {
      path: '/',              
      sameSite: 'None',       
      secure: true,           
      httpOnly: true,         
      maxAge: 10 * 60 * 1000  
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
    console.error('Error during PAR request:', error);
    return res.status(500).json({ error: 'Failed to send PAR request', details: error.message });
  }
});





// Adding route for retrieving tokens and calling `userinfo`
app.get('/retrieve-tokens', async (req, res) => {
  const cartId = req.query.cartId;
  const code = req.query.code;

  if (!code || !cartId) {
      return res.status(400).json({ error: 'Code parameter and cartId are required' });
  }

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
      const tokenSet = await rpClient.retrieveTokens(
          authorisationServerId,
          { code },
          codeVerifier,
          state,
          nonce
      );

      console.log('TokenSet received:', tokenSet);

      const claims = tokenSet.claims();
      console.log('Claims extracted:', claims);

      // Check if the user meets the required claim (e.g., 'over18')
      if (claims.over18 && claims.over18 === true) {
          const token = generateAndStoreToken(cartId);
          console.log(`Verification successful for cartId ${cartId}. Token generated: ${token}`);

          // Now call the userinfo endpoint using the access token
          const userInfo = await rpClient.getUserInfo(authorisationServerId, tokenSet.access_token);
          console.log('UserInfo received:', userInfo);

          return res.json({ claims, token, userInfo, xFapiInteractionId: tokenSet.xFapiInteractionId });
      } else {
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
