import fetch from 'node-fetch';
import { getLogger } from './logger.mjs';

const logger = getLogger('info');

// Helper function to validate cart ID with BigCommerce API
export async function validateCartWithBigCommerce(cartId) {
    const url = `https://${process.env.STORE_DOMAIN}/api/storefront/carts/${cartId}`;
    try {
        const response = await fetch(url, {
            method: 'GET',
            headers: {
                'X-Auth-Token': process.env.ACCESS_TOKEN, // BigCommerce API token
                'Content-Type': 'application/json',
            },
        });

        if (!response.ok) {
            throw new Error(`Failed to fetch cart. Status: ${response.status}, Cart ID: ${cartId}`);
        }

        const cartData = await response.json();
        return cartData;
    } catch (error) {
        logger.error(`Error validating cart with BigCommerce: ${error.message}`);
        return null; // Return null if validation fails
    }
}
