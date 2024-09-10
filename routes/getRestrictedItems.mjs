import { tokenStore } from '../app.mjs';  // Adjust the path as necessary
import express from 'express';
import { restrictedSKUs, initializeRestrictedSKUs, fetchCartItems } from '../services/checkRestrictedItems.mjs';

const router = express.Router();

// Route to get all restricted items (GET request)
router.get('/', (req, res) => {
  try {
    res.status(200).json({ restrictedSKUs: Array.from(restrictedSKUs) });
  } catch (error) {
    console.error('Error fetching restricted items:', error.message);
    res.status(500).json({ error: 'An error occurred while fetching restricted items' });
  }
});

// Route to check for restricted items in the cart (POST request)
router.post('/', async (req, res) => {
  const { cartId } = req.body;

  // Log request details
  console.log('POST /restricted-items hit');
  console.log('Cookies received:', req.cookies);
  console.log('Headers:', req.headers);

  // Check if the validation_done cookie is set
  const validationCookie = req.cookies.validation_done;
  console.log('Validation done cookie:', validationCookie);

  // If the validation_done cookie exists, skip the validation and proceed
  if (validationCookie) {
    console.log('Validation already completed, skipping the restricted items check.');
    return res.status(200).json({ message: 'Validation already completed. No need to check for restricted items.' });
  }

  // If no validation_done cookie, proceed with validation
  console.log('No validation_done cookie found. Proceeding with validation...');

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

export default router;
