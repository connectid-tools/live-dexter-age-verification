// validateCart.mjs
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

  try {
    // Call the service method and capture the response
    const result = await restrictedItemsService.checkAndRemoveRestrictedItems(cartId);

    // Return the result to the client
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
