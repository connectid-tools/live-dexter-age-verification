import express from 'express';
const router = express.Router();

export default (rpClient) => {
  router.post('/', async (req, res) => {
    const { authorisationServerId, essentialClaims, voluntaryClaims, purpose } = req.body;
    try {
      const { authUrl, code_verifier, state, nonce } = await rpClient.sendPushedAuthorisationRequest(
        authorisationServerId,
        essentialClaims || [],
        voluntaryClaims || [],
        purpose || rpClient.config.data.purpose
      );

      res.cookie('state', state, { sameSite: 'none', secure: true });
      res.cookie('nonce', nonce, { sameSite: 'none', secure: true });
      res.cookie('code_verifier', code_verifier, { sameSite: 'none', secure: true });
      res.cookie('authorisation_server_id', authorisationServerId, { sameSite: 'none', secure: true });

      return res.json({ authUrl });
    } catch (error) {
      return res.status(500).json({ error: error.message });
    }
  });

  return router;
};
