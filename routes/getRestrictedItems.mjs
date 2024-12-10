import express from 'express';
import { restrictedSKUs, initializeRestrictedSKUs, fetchCartItems } from '../services/checkRestrictedItems.mjs';
import { getLogger } from '../utils/logger.mjs'; // Import the logger
import jwt from 'jsonwebtoken'; // Import JWT library

const logger = getLogger('info');  // Create a logger instance with the desired log level
const JWT_SECRET = process.env.JWT_SECRET || 'your-very-secret-key';

const router = express.Router();

router.post('/', async (req, res) => {
  const { code } = req.body; // Extract code from the request body
  const sessionToken = req.headers.authorization?.split(' ')[1]; // Extract the session token from the Authorization header

  // Skip validation if a code exists
  if (code) {
    logger.info('Code provided, skipping restricted item checks.');
    return res.status(200).json({ message: 'User authenticated or code provided, restricted items check skipped.' });
  }

  // Check if a session token is provided
  if (!sessionToken) {
    logger.error('Authorization token is required.');
    return res.status(401).json({ error: 'Authorization token is required.' });
  }

  try {
    // Verify the session token
    const decoded = jwt.verify(sessionToken, JWT_SECRET);
    const { cartId } = decoded;

    if (!cartId) {
      logger.error('Invalid token: Missing cart ID.');
      return res.status(400).json({ error: 'Invalid token: Missing cart ID.' });
    }

    // Initialize restricted SKUs if not already loaded
    if (!restrictedSKUs || restrictedSKUs.size === 0) {
      await initializeRestrictedSKUs();
    }

    // Fetch cart items using the cart ID
    const cartItems = await fetchCartItems(cartId);
    const cartSKUs = cartItems.map(item => item.sku.toUpperCase());

    // Filter restricted items in the cart
    const restrictedItemsInCart = cartSKUs.filter(sku => restrictedSKUs.has(sku));

    // Return the restricted items
    return res.status(200).json({ restrictedSKUs: restrictedItemsInCart });
  } catch (error) {
    if (error.name === 'JsonWebTokenError' || error.name === 'TokenExpiredError') {
      logger.error('Invalid or expired session token.');
      return res.status(401).json({ error: 'Invalid or expired session token.' });
    }

    logger.error('Error checking restricted items:', error);
    res.status(500).json({ error: 'Failed to check restricted items' });
  }
});

export default router;
