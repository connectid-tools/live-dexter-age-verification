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
      console.log('JWT token refreshed successfully:', process.env.TOKEN);
    } else {
      throw new Error('Invalid response format while refreshing JWT token');
    }
  } catch (error) {
    console.error('Error refreshing JWT token:', error);
  }
}

// Function to fetch products by category with JWT check
export async function fetchProductsByCategory(categoryId) {
  let jwtToken = process.env.TOKEN;

  try {
    // Attempt to fetch products with the current JWT token
    let response = await fetch(`https://api.bigcommerce.com/stores/${process.env.STORE_HASH}/v3/catalog/products?categories:in=${categoryId}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${jwtToken}`, // Use the JWT token
      },
    });

    // Check for 401 Unauthorized error, which indicates the JWT might be expired or invalid
    if (response.status === 401) {
      console.error('401 Unauthorized - JWT token might be expired. Attempting to refresh token...');
      await refreshJWTToken();  // Refresh the token
      jwtToken = process.env.TOKEN;  // Update JWT token after refresh

      // Retry fetching products with the new JWT token
      response = await fetch(`https://api.bigcommerce.com/stores/${process.env.STORE_HASH}/v3/catalog/products?categories:in=${categoryId}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${jwtToken}`, // Use the refreshed JWT token
        },
      });
    }

    const responseBody = await response.text();
    console.log('Full response for category fetch:', responseBody);

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status} Response: ${responseBody}`);
    }

    const data = JSON.parse(responseBody);
    return data;
  } catch (error) {
    console.error('Error fetching products by category:', error.message);
    throw error;
  }
}

// Example function to initialize restricted SKUs
export async function initializeRestrictedSKUs() {
  const categoryId = process.env.CATEGORY_ID;

  try {
    const products = await fetchProductsByCategory(categoryId);
    console.log('Restricted SKUs initialized:', products);
  } catch (error) {
    console.error('Error initializing restricted SKUs:', error);
  }
}
