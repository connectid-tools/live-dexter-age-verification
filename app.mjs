import dotenv from 'dotenv';
dotenv.config();  // Load the environment variables

import express from 'express';
import path from 'path';
import cookieParser from 'cookie-parser';
import logger from 'morgan';
import createError from 'http-errors';
import cors from 'cors';
import RelyingPartyClientSdk from '@connectid-tools/rp-nodejs-sdk';
import { config } from './config.js';

const rpClient = new RelyingPartyClientSdk(config);

// Import routes
import indexRouter from './routes/index.mjs';
import validateCartRouter from './routes/restrictItems.mjs';
import getRestrictedItemsRouter from './routes/getRestrictedItems.mjs';

// Initialize Express app
const app = express();
const port = 3001;

// Use CORS middleware
const storeDomain = process.env.STORE_DOMAIN;

app.use(cors({
  origin: [`https://${storeDomain}`],
  methods: ['GET', 'POST'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true
}));

// View engine setup
app.set('views', path.join(path.resolve(), 'views'));
app.set('view engine', 'pug');

// Middleware setup
app.use(logger('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(path.resolve(), 'public')));

// Use routers
app.use('/', indexRouter);
app.use('/validate-cart', validateCartRouter);
app.use('/restricted-items', getRestrictedItemsRouter);
export const tokenStore = new Map(); // Store tokens with cartId as the key

// Generate and store token for a cartId
function generateAndStoreToken(cartId) {
  const token = Math.random().toString(36).substring(2);  // Using substring instead of substr
  const expiresAt = Date.now() + 10 * 60 * 1000;  // Token expiration time set to 10 minutes
  tokenStore.set(cartId, { token, expiresAt });
  console.log(`Token for cartId ${cartId} set. Token: ${token}`);
  return token;
}

function clearExpiredTokens() {
  const now = Date.now();
  tokenStore.forEach((tokenData, cartId) => {
    if (tokenData.expiresAt < now) {
      tokenStore.delete(cartId);
      console.log(`Expired token for cartId ${cartId} has been removed.`);
    }
  });
}

// Periodically clean up expired tokens every 5 minutes
setInterval(clearExpiredTokens, 5 * 60 * 1000); // Run every 5 minutes

// Route to handle bank selection and OIDC flow (your existing code)
app.post('/select-bank', async (req, res) => {
  const essentialClaims = ['over18'];
  const authServerId = req.body.authorisationServerId;
  const cartId = req.body.cartId;

  if (!authServerId || !cartId) {
    return res.status(400).json({ error: 'authorisationServerId and cartId are required' });
  }

  try {
    // Send the Pushed Authorization Request (PAR)
    const { authUrl, code_verifier, state, nonce } = await rpClient.sendPushedAuthorisationRequest(
      authServerId,
      essentialClaims,
      [],
      req.body.purpose
    );

    // Store state, nonce, and other tokens in cookies (but NOT validation_done yet)
    const isProduction = process.env.NODE_ENV === 'production';
    const cookieOptions = {
      path: '/',
      sameSite: 'None', 
      secure: isProduction,
      httpOnly: true,
      maxAge: 10 * 60 * 1000
    };

    res.cookie('state', state, cookieOptions);
    res.cookie('nonce', nonce, cookieOptions);
    res.cookie('code_verifier', code_verifier, cookieOptions);
    res.cookie('authorisation_server_id', authServerId, cookieOptions);

    const token = generateAndStoreToken(cartId); // Store token on server
    console.log(`Token generated for cartId ${cartId}: ${token}`);

    return res.json({ authUrl, token });
  } catch (error) {
    console.error('Error during PAR request:', error);
    return res.status(500).json({ error: 'Failed to send PAR request' });
  }
});

// Handle the token retrieval after user authentication
app.get('/retrieve-tokens', async (req, res) => {
  console.log('validation_done cookie:', req.cookies.validation_done);

  if (!req.query.code) {
    console.error('No code parameter in query string');
    return res.status(400).json({ error: 'No code parameter in query string' });
  }

  try {
    // Retrieve the tokens using the OIDC flow
    const tokenSet = await rpClient.retrieveTokens(
      req.cookies.authorisation_server_id,
      req.query,
      req.cookies.code_verifier,
      req.cookies.state,
      req.cookies.nonce
    );

    const claims = tokenSet.claims();
    const token = {
      decoded: JSON.stringify(jwtDecode(tokenSet.id_token), null, 2),
      raw: tokenSet.id_token,
    };

    console.log(`Returned claims: ${JSON.stringify(claims, null, 2)}`);

    // Only now, after successful verification, set the validation_done cookie
    const isProduction = process.env.NODE_ENV === 'production';
    const cookieOptions = {
      path: '/',
      sameSite: 'None', 
      secure: isProduction,
      httpOnly: true,
      maxAge: 10 * 60 * 1000 // Set expiration for 10 minutes
    };

    res.cookie('validation_done', 'true', cookieOptions);
    console.log('Validation_done cookie set after successful authentication.');

    // Return the claims and tokens to the client
    return res.json({ claims, token, xFapiInteractionId: tokenSet.xFapiInteractionId });
  } catch (error) {
    console.error('Error retrieving tokens:', error);
    return res.status(500).json({ error: 'Failed to retrieve tokens' });
  }
});


// Catch 404 and forward to error handler
app.use(function(req, res, next) {
  next(createError(404));
});

// Error handler
app.use(function(err, req, res, next) {
  res.locals.message = err.message;
  res.locals.error = req.app.get('env') === 'development' ? err : {};
  const statusCode = err.status || 500;
  console.error(err.stack);
  res.status(statusCode).render('error', { error: err });
});

// Start the Express server
app.listen(port, () => {
  console.log(`Server is listening on port ${port}`);
});

export default app;
