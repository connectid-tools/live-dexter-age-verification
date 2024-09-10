import { tokenStore } from '../app.mjs';  // Ensure you import the tokenStore
import express from 'express';
import restrictedItemsService from '../services/retrieveAndRestrict.mjs';

const router = express.Router();

// POST route to validate cart and remove restricted items if needed
router.post('/', async (req, res) => {
  console.log('POST /validate-cart route hit');
  const { cartId } = req.body;

  if (!cartId) {
    return res.status(400).json({ error: 'Cart ID is required' });
  }

  console.log('Validation done cookie:', req.cookies.validation_done);

  // Check if the validation_done cookie is set
  if (!req.cookies.validation_done) {
    return res.status(403).json({ message: 'Validation not completed.' });
  }

  // Check if the token for the cartId is valid
  const tokenData = tokenStore.get(cartId);
  if (!tokenData) {
    return res.status(403).json({ message: 'No token found or token expired.' });
  }

  // Validate token (if necessary, depending on your flow)
  console.log(`Token for cartId ${cartId} is valid.`);

  try {
    // Call the service method and capture the response
    const result = await restrictedItemsService.validateCart(cartId);

    // Return the validated cart information to the client
    res.status(200).json(result);
  } catch (error) {
    console.error('Error validating cart:', error);
    res.status(500).json({ error: 'Failed to validate and update cart.' });
  }
});

// Optional GET route for testing or status checking
router.get('/', (req, res) => {
  console.log('GET /validate-cart route hit');
  res.status(200).json({ message: 'GET method on /validate-cart is working' });
});

export default router;
