import express from 'express';
const router = express.Router();

export default (rpClient) => {
  router.get('/', async (req, res) => {
    try {
      const participants = await rpClient.getParticipants();
      res.json(participants);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  return router;
};
