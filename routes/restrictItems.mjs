import { tokenStore } from '../app.mjs';
import express from 'express';
import restrictedItemsService from '../services/retrieveAndRestrict.mjs';

const router = express.Router();

router.post('/', async (req, res) => {
  const { cartId, code } = req.body;  // Extract both cartId and code
  const tokenData = tokenStore.get(cartId);

  // Skip validation if token is valid or if a code exists
  if ((tokenData && tokenData.expiresAt > Date.now()) || code) {
    console.log('Token valid or code found, skipping cart validation.');
    return res.status(200).json({ message: 'User authenticated or code provided, cart validation skipped.' });
  }

  console.log('No valid token or code, proceeding with cart validation.');

  try {
    const result = await restrictedItemsService.validateCart(cartId);
    res.status(200).json(result);
  } catch (error) {
    console.error('Error validating cart:', error);
    res.status(500).json({ error: 'Failed to validate and update cart.' });
  }
});

export default router;
