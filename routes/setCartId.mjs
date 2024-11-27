import express from 'express';
import { validateCartWithBigCommerce } from '../utils/cartValidation.mjs'; // Import validation logic
import { getLogger } from '../utils/logger.mjs';

const logger = getLogger('info');
const router = express.Router();

router.post('/', async (req, res) => {
    const { cartId } = req.body;

    if (!cartId) {
        logger.error('cartId parameter is required');
        return res.status(400).json({ error: 'cartId parameter is required' });
    }

    // Validate the cartId with BigCommerce API
    const cartData = await validateCartWithBigCommerce(cartId);
    if (!cartData) {
        logger.error('Invalid cartId provided or cart does not exist');
        return res.status(400).json({ error: 'Invalid cartId or cart does not exist' });
    }

    // Store the cartId in the session
    req.session.cartId = cartId;
    logger.info(`Cart ID stored in session: ${cartId}`);
    return res.status(200).json({ message: 'Cart ID validated and stored successfully' });
});

export default router;
