import { tokenStore } from '../app.mjs';  // Ensure you import the tokenStore
import express from 'express';
import restrictedItemsService from '../services/retrieveAndRestrict.mjs';

const router = express.Router();

// POST route to validate cart and remove restricted items if needed
router.post('/', async (req, res) => {
  const { cartId } = req.body;

  console.log('POST /restricted-items hit');
  console.log('Cookies received:', req.cookies);

  // Check if the validation_done cookie is set
  const validationCookie = req.cookies.validation_done;
  console.log('Validation done cookie:', validationCookie);

  // If the cookie exists, skip the validation and return a success message
  if (validationCookie) {
    console.log('Validation already completed, skipping cart validation.');
    return res.status(200).json({ message: 'Validation already completed. Skipping cart validation.' });
  }

  // If no validation_done cookie, proceed with validation
  console.log('No validation_done cookie found. Proceeding with cart validation...');

  // Check if the token for the cartId is valid
  const tokenData = tokenStore.get(cartId);
  if (!tokenData) {
    console.warn(`No token found or token expired for cartId: ${cartId}`);
    return res.status(403).json({ message: 'No token found or token expired.' });
  }

  console.log(`Token for cartId ${cartId} is valid.`);

  try {
    // Call the service method to validate the cart and handle restricted items
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
