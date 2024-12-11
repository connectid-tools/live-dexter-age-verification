import express from 'express';
import restrictedItemsService from '../services/retrieveAndRestrict.mjs';
import { getLogger } from '../utils/logger.mjs'; // Import the logger
const logger = getLogger('info');  // Create a logger instance with the desired log level

const router = express.Router();

router.post('/', async (req, res) => {
  const { cartId, code } = req.body;  // Extract both cartId and code

  // Skip validation if a code exists
  if (code) {
    logger.info('Code found, skipping cart validation.');
    return res.status(200).json({ message: 'Code provided, cart validation skipped.' });
  }

  logger.info('No code found, proceeding with cart validation.');

  try {
    const result = await restrictedItemsService.validateCart(cartId);
    res.cookie('cartId', cartId, { httpOnly: false, secure: true, sameSite: 'None', maxAge: 3600 * 1000, domain: 'sh-checkout-validator-qud6t.ondigitalocean.app' }); // 1 hour
    
    res.status(200).json(result);
  } catch (error) {
    logger.error('Error validating cart:', error);
    res.status(500).json({ error: 'Failed to validate and update cart.' });
  }
});

export default router;
