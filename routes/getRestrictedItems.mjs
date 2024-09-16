import { tokenStore } from '../utils/tokenManager.mjs';
import express from 'express';
import { restrictedSKUs, initializeRestrictedSKUs, fetchCartItems } from '../services/checkRestrictedItems.mjs';

const router = express.Router();

router.post('/', async (req, res) => {
  const { cartId, code } = req.body;  // Extract both cartId and code
  const tokenData = tokenStore.get(cartId);

  // Check if a valid token or a code exists, and skip validation if true
  if ((tokenData && tokenData.expiresAt > Date.now()) || code) {
    console.log('Token valid or code found, skipping restricted item checks.');
    return res.status(200).json({ message: 'User authenticated or code provided, restricted items check skipped.' });
  }

  console.log('No valid token or code, proceeding with restricted item checks.');

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
