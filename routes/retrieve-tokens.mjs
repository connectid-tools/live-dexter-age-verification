import express from 'express';
const router = express.Router();

export default (rpClient) => {
  router.get('/', async (req, res) => {
    if (!req.query.code) {
      return res.status(400).json({ error: 'No code parameter in query string' });
    }

    try {
      const tokenSet = await rpClient.retrieveTokens(
        req.cookies.authorisation_server_id,
        req.query,
        req.cookies.code_verifier,
        req.cookies.state,
        req.cookies.nonce
      );
      const claims = tokenSet.claims();
      const token = {
        decoded: JSON.stringify(tokenSet.id_token, null, 2),
        raw: tokenSet.id_token,
      };

      return res.json({ claims, token });
    } catch (error) {
      return res.status(500).json({ error: error.message });
    }
  });

  return router;
};
