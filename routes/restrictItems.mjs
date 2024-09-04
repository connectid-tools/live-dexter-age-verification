import express from 'express'; 
import restrictedItemsService from '../services/retrieveAndRestrict.mjs'; 

const router = express.Router(); 

// Define POST route to validate cart and remove restricted items if needed
router.post('/', async (req, res) => {
  const { cartId } = req.body;

  if (!cartId) {
    return res.status(400).json({ error: 'Cart ID is required' });
  }

  try {
    // Call the service method and capture the response
    const result = await restrictedItemsService.checkAndRemoveRestrictedItems(cartId);

    // Return the result to the client
    res.status(200).json(result);
  } catch (error) {
    console.error('Error validating cart:', error);
    res.status(500).json({ error: 'Failed to validate and update cart.' });
  }
});

export default router; 
