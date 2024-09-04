// getRestrictedItems.mjs
import express from 'express';
import { restrictedSKUs } from '../services/checkRestrictedItems.mjs';

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

// Route to check for restricted items (POST request)
router.post('/', (req, res) => {
  try {
    const { cartId } = req.body;
    // Logic to check for restricted items in the cart based on cartId
    const restrictedItems = Array.from(restrictedSKUs); // Example logic, replace with actual check logic

    // Respond with restricted items if found
    res.status(200).json({ restrictedItems });
  } catch (error) {
    console.error('Error fetching restricted items:', error.message);
    res.status(500).json({ error: 'An error occurred while fetching restricted items' });
  }
});

export default router;
