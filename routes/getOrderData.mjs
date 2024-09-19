import express from 'express';
import fetch from 'node-fetch';

const router = express.Router();

// Route to fetch the order data from BigCommerce API
router.get('/get-order-data', async (req, res) => {
    const storeHash = process.env.STORE_HASH;  // Store hash from environment variables
    const accessToken = 'gungxjqyahfn9lm5vpcfbe2n5zi3e51';  // Access token from environment variables
  
    const options = {
      method: 'GET',
      headers: {
        'X-Auth-Token': accessToken,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      }
    };
  
    try {
      // Use the BigCommerce v3 API endpoint to fetch the orders
      const orderUrl = `https://api.bigcommerce.com/stores/${storeHash}/v3/orders`;
      const response = await fetch(orderUrl, options);
  
      if (response.ok) {
        const orderData = await response.json();
        
        // Assuming you want the latest order
        const latestOrder = orderData.data[0];  // Get the first order in the response
        const orderId = latestOrder.id;
  
        console.log('Order ID:', orderId);
  
        // Send the order data (or just the orderId) back to the frontend
        res.status(200).json({ orderId, orderData: latestOrder });
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