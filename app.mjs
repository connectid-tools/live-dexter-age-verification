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


// Handle the user's bank selection and start the OIDC flow
app.post('/select-bank', async (req, res) => {
  const essentialClaims = ['over18']; // Only requesting the over18 claim
  const voluntaryClaims = [];
  const purpose = req.body.purpose || config.data.purpose;
  const authServerId = req.body.authorisationServerId;

  if (!authServerId) {
    const error = 'authorisationServerId parameter is required';
    console.error(error);
    return res.status(400).json({ error });
  }

  try {
    console.log(`Processing request to send PAR with authorisationServerId='${authServerId}', essentialClaim='over18'`);

    // Send the Pushed Authorization Request (PAR)
    const { authUrl, code_verifier, state, nonce, xFapiInteractionId } = await rpClient.sendPushedAuthorisationRequest(
      authServerId,
      essentialClaims,
      voluntaryClaims,
      purpose
    );

    // Set cookies for state, nonce, and other data
    const isProduction = process.env.NODE_ENV === 'production';
    const cookieOptions = {
      path: '/',
      sameSite: 'lax', // or 'none' if you're using cross-origin requests and HTTPS
      secure: false,   // Set to 'false' for local development, true in production
      httpOnly: false, // Optional, remove this if you need client-side access to the cookie
    };

    // Set validation_done cookie to indicate validation is complete
    res.cookie('validation_done', 'true', { ...cookieOptions, maxAge: 10 * 60 * 1000 }); // Expires in 10 minutes
    console.log('validation_done cookie set successfully.');

    res.cookie('state', state, cookieOptions);
    res.cookie('nonce', nonce, cookieOptions);
    res.cookie('code_verifier', code_verifier, cookieOptions);
    res.cookie('authorisation_server_id', authServerId, cookieOptions);

        // Log the actual headers being sent, including the cookies
        res.on('finish', () => {
          console.log('Response headers:', res.getHeaders()); // This will include Set-Cookie headers
        });

    console.log(`PAR sent to authorisationServerId='${authServerId}', returning URL '${authUrl}'`);

    // Return the authorization URL to the client
    return res.json({ authUrl });
  } catch (error) {
    console.error('Error during PAR request:', error);  // Log full error details
    return res.status(500).json({ error: 'Failed to send PAR request', details: error.message });
  }
});






// Handle the token retrieval after user authentication
app.get('/retrieve-tokens', async (req, res) => {
  // Log the validation_done cookie
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

    // Extract claims and tokens
    const claims = tokenSet.claims();
    const token = {
      decoded: JSON.stringify(jwtDecode(tokenSet.id_token), null, 2),
      raw: tokenSet.id_token,
    };

    console.log(`Returned claims: ${JSON.stringify(claims, null, 2)}`);

    // Clear the validation_done cookie after successful retrieval (optional)
    res.clearCookie('validation_done', { path: '/' });

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
