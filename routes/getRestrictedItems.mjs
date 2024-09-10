import { tokenStore } from '../app.mjs';
import express from 'express';
import { restrictedSKUs, initializeRestrictedSKUs, fetchCartItems } from '../services/checkRestrictedItems.mjs';

const router = express.Router();

router.get('/', (req, res) => {
  try {
    res.status(200).json({ restrictedSKUs: Array.from(restrictedSKUs) });
  } catch (error) {
    console.error('Error fetching restricted items:', error.message);
    res.status(500).json({ error: 'An error occurred while fetching restricted items' });
  }
});

router.post('/', async (req, res) => {
  const { cartId } = req.body;
  const tokenData = tokenStore.get(cartId);

  // Check if the token is valid and has not expired
  if (tokenData && tokenData.expiresAt > Date.now()) {
    console.log('Token valid, skipping restricted item checks.');
    return res.status(200).json({ message: 'User authenticated, restricted items check skipped.' });
  }

  console.log('No valid token, proceeding with restricted item checks.');

  try {
    if (!restrictedSKUs || restrictedSKUs.size === 0) {
      await initializeRestrictedSKUs();
    }

    const cartItems = await fetchCartItems(cartId);
    const cartSKUs = cartItems.map(item => item.sku.toUpperCase());

    const restrictedItemsInCart = cartSKUs.filter(sku => restrictedSKUs.has(sku));

    return res.status(200).json({ restrictedSKUs: restrictedItemsInCart });
  } catch (error) {
    console.error('Error checking restricted items:', error);
    res.status(500).json({ error: 'Failed to check restricted items' });
  }
});

export default router;
