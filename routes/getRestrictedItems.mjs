import { tokenStore } from '../app.mjs';  // Adjust the path as necessary
import express from 'express';
import { restrictedSKUs, initializeRestrictedSKUs, fetchCartItems } from '../services/checkRestrictedItems.mjs';

const router = express.Router();

// Route to get all restricted items (GET request)
router.get('/', (req, res) => {
  try {
    // Convert the set to an array and respond with the list of restricted SKUs
    res.status(200).json({ restrictedSKUs: Array.from(restrictedSKUs) });
  } catch (error) {
    console.error('Error fetching restricted items:', error.message);
    res.status(500).json({ error: 'An error occurred while fetching restricted items' });
  }
});

// Route to check for restricted items in the cart (POST request)
router.post('/', async (req, res) => {
  const { cartId } = req.body;

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

  // Proceed with checking restricted items logic
  try {
    // Ensure restricted SKUs are initialized
    if (!restrictedSKUs || restrictedSKUs.size === 0) {
      await initializeRestrictedSKUs();
    }

    const cartItems = await fetchCartItems(cartId);
    const cartSKUs = cartItems.map(item => item.sku.toUpperCase()); // Normalize cart SKUs

    // Check for restricted SKUs in the cart
    const restrictedItemsInCart = cartSKUs.filter(sku => restrictedSKUs.has(sku));

    if (restrictedItemsInCart.length > 0) {
      res.status(200).json({ restrictedSKUs: restrictedItemsInCart });
    } else {
      res.status(200).json({ restrictedSKUs: [] }); // No restricted items
    }
  } catch (error) {
    console.error('Error checking restricted items:', error);
    res.status(500).json({ error: 'Failed to check restricted items' });
  }
});


export default router;
