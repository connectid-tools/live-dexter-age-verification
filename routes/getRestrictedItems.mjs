// getRestrictedItems.mjs
import express from 'express';
import { restrictedSKUs } from '../services/checkRestrictedItems.mjs'; 

const router = express.Router();

// Route to get all restricted items
router.get('/', (req, res) => {
  try {
    // Convert the set to an array and respond with the list of restricted SKUs
    res.status(200).json({ restrictedSKUs: Array.from(restrictedSKUs) });
  } catch (error) {
    console.error('Error fetching restricted items:', error.message);
    res.status(500).json({ error: 'An error occurred while fetching restricted items' });
  }
});

export default router;
