import express from 'express';
const router = express.Router();

router.get('/retrieve-tokens', async (req, res) => {
  const cartId = req.query.cartId;
  const code = req.query.code;

  if (!code || !cartId) {
    return res.status(400).json({ error: 'Code parameter and cartId are required' });
  }

  const authorisationServerId = req.cookies.authorisation_server_id;
  const codeVerifier = req.cookies.code_verifier;
  const state = req.cookies.state;
  const nonce = req.cookies.nonce;

  if (!authorisationServerId || !codeVerifier || !state || !nonce) {
    console.error('Missing one or more required cookies:', {
      authorisationServerId,
      codeVerifier,
      state,
      nonce
    });
    return res.status(400).json({ error: 'Missing required cookies for token exchange.' });
  }

  try {
    const tokenSet = await rpClient.retrieveTokens(
      authorisationServerId,
      { code },
      codeVerifier,
      state,
      nonce
    );

    console.log('TokenSet received:', tokenSet);

    const claims = tokenSet.claims();
    console.log('Claims extracted:', claims);

    if (claims.over18 && claims.over18 === true) {
      const token = generateAndStoreToken(cartId);  
      console.log(`Verification successful for cartId ${cartId}. Token generated: ${token}`);

      const userInfo = await rpClient.getUserInfo(authorisationServerId, tokenSet.access_token);
      console.log('UserInfo received:', userInfo);

      return res.json({ claims, token, userInfo, xFapiInteractionId: tokenSet.xFapiInteractionId });
    } else {
      return res.status(400).json({ error: 'User verification failed. Age requirement not met.' });
    }
  } catch (error) {
    console.error('Error retrieving tokens:', error);
    return res.status(500).json({ error: 'Failed to retrieve tokens', details: error.message });
  }
});

export default router;