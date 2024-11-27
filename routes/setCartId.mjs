import express from 'express';
import { getLogger } from '../utils/logger.mjs';

const logger = getLogger('info');
const router = express.Router();

router.post('/', async (req, res) => {
    const { cartId } = req.body;

    if (!cartId) {
        logger.error('cartId parameter is required');
        return res.status(400).json({ error: 'cartId parameter is required' });
    }

    // Simplified validation: Assume cartId is valid if provided
    req.session.cartId = cartId;
    logger.info(`Cart ID stored in session: ${cartId}`);
    return res.status(200).json({ message: 'Cart ID validated and stored successfully' });
});
export default router;
