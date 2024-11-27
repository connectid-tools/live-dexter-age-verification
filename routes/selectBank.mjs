import express from 'express';
import session from 'express-session';
import RelyingPartyClientSdk from '@connectid-tools/rp-nodejs-sdk';
import { config } from '../config.js';
import { getLogger } from '../utils/logger.mjs';

const logger = getLogger('info'); // Logger instance
const router = express.Router();
const rpClient = new RelyingPartyClientSdk(config);

// Use session middleware
router.use(
  session({
    secret: 'your-secret-key', // Replace with a secure secret
    resave: false,
    saveUninitialized: true,
    cookie: { secure: false }, // Set `secure: true` in production with HTTPS
  })
);

// Helper function to validate cart ID with BigCommerce API
async function validateCartWithBigCommerce(cartId) {
  const url = `https://${process.env.STORE_DOMAIN}/api/storefront/carts/${cartId}`;
  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'X-Auth-Token': process.env.ACCESS_TOKEN, // BigCommerce API token
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch cart. Status: ${response.status}, Cart ID: ${cartId}`);
    }

    const cartData = await response.json();
    return cartData;
  } catch (error) {
    logger.error(`Error validating cart with BigCommerce: ${error.message}`);
    return null; // Return null if validation fails
  }
}

// Endpoint to set the cart ID for a session
router.post('/set-cart-id', async (req, res) => {
  const { cartId } = req.body;

  if (!cartId) {
    logger.error('cartId parameter is required');
    return res.status(400).json({ error: 'cartId parameter is required' });
  }

  // Validate the cartId with BigCommerce API
  const cartData = await validateCartWithBigCommerce(cartId);
  if (!cartData) {
    logger.error('Invalid cartId provided or cart does not exist');
    return res.status(400).json({ error: 'Invalid cartId or cart does not exist' });
  }

  // Store the cartId in the session
  req.session.cartId = cartId;
  logger.info(`Cart ID stored in session: ${cartId}`);
  return res.status(200).json({ message: 'Cart ID validated and stored successfully' });
});

// Endpoint to process the select-bank request
router.post('/select-bank', async (req, res) => {
  const { cartId, essentialClaims, authorisationServerId } = req.body;

  logger.info('--- Received request to /select-bank ---');
  logger.info(`Payload: ${JSON.stringify(req.body, null, 2)}`);

  // Check if cartId exists in the session
  if (!req.session.cartId) {
    logger.error('No cartId found in session');
    return res.status(400).json({ error: 'No cartId set for the current session' });
  }

  // Validate the provided cartId against the session cartId
  if (req.session.cartId !== cartId) {
    logger.error(
      `Cart ID mismatch: received '${cartId}' does not match session cartId '${req.session.cartId}'`
    );
    return res.status(400).json({ error: 'Invalid cartId for the current session' });
  }

  // Validate the cartId again with BigCommerce for extra security
  const cartData = await validateCartWithBigCommerce(cartId);
  if (!cartData) {
    logger.error('Cart ID is not valid according to BigCommerce');
    return res.status(400).json({ error: 'Invalid cartId' });
  }

  // Proceed with the pushed authorization request
  try {
    // Send the pushed authorization request
    const { authUrl, code_verifier, state, nonce, xFapiInteractionId } = await rpClient.sendPushedAuthorisationRequest(
      authServerId,
      essentialClaims,
      voluntaryClaims,
      purpose
    );

    // Set cookies and respond with the authorization URL
    res.cookie('state', state, { path: '/', sameSite: 'none', secure: true, maxAge: 5 * 60 * 1000 });
    res.cookie('nonce', nonce, { path: '/', sameSite: 'none', secure: true, maxAge: 5 * 60 * 1000 });
    res.cookie('code_verifier', code_verifier, { path: '/', sameSite: 'none', secure: true, maxAge: 5 * 60 * 1000 });

    return res.status(200).json({ authUrl, state, nonce, code_verifier });
  } catch (error) {
    logger.error('Error during PAR request:', error);
    return res.status(500).json({ error: 'Failed to send PAR request', details: error.message });
  }
});

export default router;
