import dotenv from 'dotenv';
import fetch from 'node-fetch';

// Load environment variables from .env file
dotenv.config();

// Function to refresh JWT Token
export async function refreshJWTToken() {

  try {
    console.log('Refreshing JWT token...');
    const store_hash = process.env.STORE_HASH;
    const storeDomain = process.env.STORE_DOMAIN;
    const endpointDomain = process.env.ENDPOINT_DOMAIN;
    const accessToken = process.env.ACCESS_TOKEN;

    if (!store_hash || !storeDomain || !endpointDomain || !accessToken) {
      throw new Error('Missing required environment variables: STORE_HASH, STORE_DOMAIN, ENDPOINT_DOMAIN, or ACCESS_TOKEN');
    }

    const url = `https://api.bigcommerce.com/stores/${store_hash}/v3/storefront/api-token`;

    const options = {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        'X-Auth-Token': accessToken,
      },
      body: JSON.stringify({
        allowed_cors_origins: [
          `https://${storeDomain}.mybigcommerce.com`,
          `https://${endpointDomain}.ondigitalocean.app`
        ],
        channel_id: 1,
        expires_at: Math.floor(Date.now() / 1000) + 3600,  // Expire in one hour
      }),
    };

    const response = await fetch(url, options);

    if (!response.ok) {
      const errorResponse = await response.text();
      console.error('Failed to refresh JWT token:', response.statusText, errorResponse);
      throw new Error(`Failed to refresh JWT token: ${response.statusText} - ${errorResponse}`);
    }

    const data = await response.json();

    if (data && data.data && data.data.token) {
      process.env.TOKEN = data.data.token;
      console.log('JWT token refreshed successfully');
    } else {
      throw new Error('Invalid response format while refreshing JWT token');
    }
  } catch (error) {
    console.error('Error refreshing JWT token:', error);
  }
}
