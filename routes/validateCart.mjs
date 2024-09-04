import express from 'express'; // Import express using ESM
import restrictedItemsService from '../services/restrictedItemsService.mjs'; // Import the service using ESM

const router = express.Router(); // Initialize the router object

// Define GET route for testing or simple validation page
router.get('/', (req, res) => {
  res.status(200).send('Validate Cart GET route is working!');
});

// Define POST route to validate cart and remove restricted items if needed
router.post('/', async (req, res) => {
  const { cartId } = req.body; // Extract cart ID from the request body

  if (!cartId) {
    return res.status(400).json({ error: 'Cart ID is required' }); // Handle missing cart ID
  }

  try {
    await restrictedItemsService.checkAndRemoveRestrictedItems(cartId); // Use the service method to validate the cart
    res.status(200).json({ message: 'Cart validated and updated if necessary.' });
  } catch (error) {
    console.error('Error validating cart:', error);
    res.status(500).json({ error: 'Failed to validate and update cart.' });
  }
});

export default router; // Export the router using ESM
