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
  const expiresAt = Date.now() + 5 * 60 * 1000;  // Token expiration set to 5 minutes
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

// Select bank route and OIDC flow
app.post('/select-bank', async (req, res) => {
  const essentialClaims = ['over18'];
  const authServerId = req.body.authorisationServerId;
  const cartId = req.body.cartId;

  if (!authServerId || !cartId) {
    return res.status(400).json({ error: 'authorisationServerId and cartId are required' });
  }

  try {
    const { authUrl } = await rpClient.sendPushedAuthorisationRequest(
      authServerId,
      essentialClaims,
      [],
      req.body.purpose
    );

    const token = generateAndStoreToken(cartId);  // Generate and store token
    return res.json({ authUrl, token });
  } catch (error) {
    console.error('Error during PAR request:', error);
    return res.status(500).json({ error: 'Failed to send PAR request' });
  }
});

// Token retrieval route
app.get('/retrieve-tokens', async (req, res) => {
  if (!req.query.code) {
    return res.status(400).json({ error: 'No code parameter in query string' });
  }

  try {
    const tokenSet = await rpClient.retrieveTokens(
      req.cookies.authorisation_server_id,
      req.query,
      req.cookies.code_verifier,
      req.cookies.state,
      req.cookies.nonce
    );

    const claims = tokenSet.claims();
    const token = { raw: tokenSet.id_token };

    // Return claims and token to the client
    return res.json({ claims, token, xFapiInteractionId: tokenSet.xFapiInteractionId });
  } catch (error) {
    console.error('Error retrieving tokens:', error);
    return res.status(500).json({ error: 'Failed to retrieve tokens' });
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
