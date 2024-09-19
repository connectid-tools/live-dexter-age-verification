import express from 'express';
import fetch from 'node-fetch';

const router = express.Router();

// Route to fetch the order data from BigCommerce API
router.get('/get-order-data', async (req, res) => {
    const options = {
        method: 'GET',
        headers: {
            'Content-Type': 'application/json',
            'X-Auth-Token': '1b2iqeour6ky2lc7trmjby5s555o2mk'  // BigCommerce API token
        }
    };

    try {
        // Make the request to BigCommerce v3 API to get the orders
        const response = await fetch('https://api.bigcommerce.com/stores/pmsgmprrgp/v3/orders', options);

        if (response.ok) {
            const orderData = await response.json();
            // Send the order data back to the frontend
            res.status(200).json(orderData);
        } else {
            console.error('Failed to fetch order details:', response.status);
            res.status(response.status).json({ error: 'Failed to fetch order details' });
        }
    } catch (err) {
        console.error('Error fetching order details:', err);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

export default router;
