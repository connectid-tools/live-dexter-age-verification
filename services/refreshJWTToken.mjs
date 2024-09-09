import dotenv from 'dotenv';
import fetch from 'node-fetch';

dotenv.config();

// In-memory storage for the JWT token and expiry time
let jwtToken = null;
let jwtExpiry = 0;

// Function to refresh JWT Token
export async function refreshJWTToken() {
    try {
        console.log('Refreshing JWT token...');
        const storeHash = process.env.STORE_HASH;
        const accessToken = process.env.ACCESS_TOKEN;
        const storeDomain = process.env.STORE_DOMAIN;
        const endPoinDomain = process.env.ENDPOINT_DOMAIN;

        if (!storeHash || !accessToken) {
            throw new Error('Missing required environment variables: STORE_HASH or ACCESS_TOKEN');
        }

        const url = `https://api.bigcommerce.com/stores/${storeHash}/v3/storefront/api-token`;
        const options = {
            method: 'POST',
            headers: {
                Accept: 'application/json',
                'Content-Type': 'application/json',
                'X-Auth-Token': accessToken,
            },
            body: JSON.stringify({
                allowed_cors_origins: [
                    `https://${storeDomain}`,
                    `https://${endPoinDomain}.ondigitalocean.app`
                ],
                channel_id: 1,
                expires_at: Math.floor(Date.now() / 1000) + 3600, // Expire in one hour
            }),
        };

        const response = await fetch(url, options);

        if (!response.ok) {
            const errorResponse = await response.text();
            console.error('Failed to refresh JWT token:', response.statusText, errorResponse);
            throw new Error(`Failed to refresh JWT token: ${response.statusText} - ${errorResponse}`);
        }

        const data = await response.json();
        console.log('Response Data:', data);

        if (data && data.data && data.data.token) {
            jwtToken = data.data.token;
            jwtExpiry = Math.floor(Date.now() / 1000) + 3600; // Update expiry time
            console.log('JWT token refreshed successfully:', jwtToken);
        } else {
            throw new Error('Invalid response format while refreshing JWT token');
        }
    } catch (error) {
        console.error('Error refreshing JWT token:', error);
        throw error;
    }
}

// Function to check if JWT token is expired
function isTokenExpired() {
    return !jwtToken || Math.floor(Date.now() / 1000) >= jwtExpiry;
}

// Function to get JWT token, refreshes if expired
async function getJwtToken() {
    if (isTokenExpired()) {
        console.log('JWT token is missing or expired. Fetching a new token...');
        await refreshJWTToken();
    } else {
        console.log('JWT token is valid. Using existing token:', jwtToken);
    }

    console.log('Current JWT Token:', jwtToken); // Log the token whenever it's accessed
    return jwtToken;
}

// Export the getJwtToken function to be used in other files
export { getJwtToken };
