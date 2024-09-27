import express from 'express';
import restrictedItemsService from '../services/retrieveAndRestrict.mjs';

const router = express.Router();

router.post('/', async (req, res) => {
  const { cartId, code } = req.body;  // Extract both cartId and code

  // Skip validation if a code exists
  if (code) {
    // console.log('Code found, skipping cart validation.');
    return res.status(200).json({ message: 'Code provided, cart validation skipped.' });
  }

  // console.log('No code found, proceeding with cart validation.');

  try {
    const result = await restrictedItemsService.validateCart(cartId);
    res.status(200).json(result);
  } catch (error) {
    console.error('Error validating cart:', error);
    res.status(500).json({ error: 'Failed to validate and update cart.' });
  }
});

export default router;
