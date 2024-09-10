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

  if (!validationCookie) {
    console.warn('Validation not completed. Validation done cookie is missing.');
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
    if (!restrictedSKUs || restrictedSKUs.size === 0) {
      console.log('Initializing restricted SKUs...');
      await initializeRestrictedSKUs();
    }

    const cartItems = await fetchCartItems(cartId);
    const cartSKUs = cartItems.map(item => item.sku.toUpperCase()); // Normalize cart SKUs

    console.log(`Fetched cart items for cartId ${cartId}:`, cartSKUs);

    // Check for restricted SKUs in the cart
    const restrictedItemsInCart = cartSKUs.filter(sku => restrictedSKUs.has(sku));

    if (restrictedItemsInCart.length > 0) {
      console.log(`Restricted items found in cart ${cartId}:`, restrictedItemsInCart);
      return res.status(200).json({ restrictedSKUs: restrictedItemsInCart });
    } else {
      console.log(`No restricted items found in cart ${cartId}.`);
      return res.status(200).json({ restrictedSKUs: [] });
    }
  } catch (error) {
    console.error('Error checking restricted items:', error);
    res.status(500).json({ error: 'Failed to check restricted items' });
  }
});

// Optional GET route for testing or status checking
router.get('/', (req, res) => {
  console.log('GET /validate-cart route hit');
  res.status(200).json({ message: 'GET method on /validate-cart is working' });
});

export default router;
