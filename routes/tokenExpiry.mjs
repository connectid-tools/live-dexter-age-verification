import express from 'express';
const router = express.Router();

router.post('/token-expiry', (req, res) => {
  const { cartId, token } = req.body;  // Get cartId and token from request body

  console.log(`Received request for cartId: ${cartId} with token: ${token}`);

  // Check if token exists in tokenStore
  const tokenData = tokenStore.get(cartId);
  if (!tokenData) {
    console.error(`No token found for cartId: ${cartId}`);
    return res.status(401).json({ error: 'Invalid or expired token' });
  }

  // Check if the token has expired
  const currentTime = Date.now();
  if (currentTime > tokenData.expiresAt) {
    console.error(`Token for cartId ${cartId} has expired.`);
    tokenStore.delete(cartId);  // Optionally remove expired token
    return res.status(401).json({ error: 'Token has expired' });
  }

  // Check if the token matches
  if (tokenData.token !== token) {
    console.error(`Token mismatch for cartId ${cartId}: received token=${token}, stored token=${tokenData.token}`);
    return res.status(401).json({ error: 'Invalid or expired token' });
  }

  // Token is valid and not expired
  console.log(`Token validated successfully for cartId ${cartId}.`);
  res.json({ message: 'Access granted to restricted resource' });
});

router.get('/token-expiry', (req, res) => {
  const { cartId, token } = req.query;  // Get cartId and token from query parameters

  console.log(`Received request for cartId: ${cartId} with token: ${token}`);

  // Check if token exists in tokenStore
  const tokenData = tokenStore.get(cartId);
  if (!tokenData) {
    console.error(`No token found for cartId: ${cartId}`);
    return res.status(401).json({ error: 'Invalid or expired token' });
  }

  // Check if the token has expired
  const currentTime = Date.now();
  if (currentTime > tokenData.expiresAt) {
    console.error(`Token for cartId ${cartId} has expired.`);
    tokenStore.delete(cartId);  // Optionally remove expired token
    return res.status(401).json({ error: 'Token has expired' });
  }

  // Check if the token matches
  if (tokenData.token !== token) {
    console.error(`Token mismatch for cartId ${cartId}: received token=${token}, stored token=${tokenData.token}`);
    return res.status(401).json({ error: 'Invalid or expired token' });
  }

  // Token is valid and not expired
  console.log(`Token validated successfully for cartId ${cartId}.`);
  res.json({ message: 'Access granted to restricted resource' });
});

export default router;