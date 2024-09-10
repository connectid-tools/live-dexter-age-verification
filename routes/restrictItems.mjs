import { tokenStore } from '../app.mjs';  // Ensure you import the tokenStore
import express from 'express';
import restrictedItemsService from '../services/retrieveAndRestrict.mjs';

const router = express.Router();

// POST route to validate cart and remove restricted items if needed
router.post('/', async (req, res) => {
  console.log('POST /validate-cart route hit');
  console.log('Cookies received:', req.cookies);
  console.log('Headers:', req.headers);

  const { cartId } = req.body;

  if (!cartId) {
    console.error('Cart ID is missing in the request.');
    return res.status(400).json({ error: 'Cart ID is required' });
  }

  // Check if the validation_done cookie is set
  const validationCookie = req.cookies.validation_done;
  console.log('Validation done cookie:', validationCookie);

  if (!validationCookie) {
    console.warn('Validation not completed. Missing validation_done cookie.');
    return res.status(403).json({ message: 'Validation not completed.' });
  }

  // Check if the token for the cartId is valid
  const tokenData = tokenStore.get(cartId);
  if (!tokenData) {
    console.warn(`No token found or token expired for cartId: ${cartId}`);
    return res.status(403).json({ message: 'No token found or token expired.' });
  }

  console.log(`Token for cartId ${cartId} is valid.`);

  try {
    const result = await restrictedItemsService.validateCart(cartId);
    console.log(`Cart ${cartId} validated successfully.`);
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
