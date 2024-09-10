import { tokenStore } from '../app.mjs';
import express from 'express';
import restrictedItemsService from '../services/retrieveAndRestrict.mjs';

const router = express.Router();

router.post('/', async (req, res) => {
  const { cartId } = req.body;
  const tokenData = tokenStore.get(cartId);

  // Skip validation if token is valid
  if (tokenData && tokenData.expiresAt > Date.now()) {
    console.log('Token valid, skipping cart validation.');
    return res.status(200).json({ message: 'User authenticated, cart validation skipped.' });
  }

  console.log('No valid token, proceeding with cart validation.');

  try {
    const result = await restrictedItemsService.validateCart(cartId);
    res.status(200).json(result);
  } catch (error) {
    console.error('Error validating cart:', error);
    res.status(500).json({ error: 'Failed to validate and update cart.' });
  }
});

export default router;
