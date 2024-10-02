import cors from 'cors';

// Define allowed origins, including environment variables for dynamic domains
const allowedOrigins = [
  `https://${process.env.STORE_DOMAIN}`,
  `https://${process.env.ENDPOINT_DOMAIN}.ondigitalocean.app`,
  `https://api.bigcommerce.com`
];

// Log the allowed origins at server start for debugging purposes
console.log('Allowed origins:', allowedOrigins.join(', '));  // Log allowed origins

// CORS Options for Express with Logging
export const corsOptions = {
  origin: function (origin, callback) {
    console.log('Incoming request from origin:', origin);
    console.log('Allowed origins:', allowedOrigins.join(', '));  // Log allowed origins on every request

    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);  // Allow the request
    } else {
      callback(new Error('Not allowed by CORS'));  // Block the request
    }
  },
  credentials: true,  // Allow credentials (cookies, etc.)
};

// Middleware to set custom CORS headers
export const setCorsHeaders = (req, res, next) => {
  const origin = req.headers.origin;

  // Check if the origin is in the allowed list
  if (allowedOrigins.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);  // Use the origin dynamically
    console.log(`Setting CORS headers for allowed origin: ${origin}`);
  } else {
    console.warn(`No CORS headers set for origin: ${origin}`);
  }

  // Set headers for CORS support
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-XSRF-TOKEN');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');

  // Call the next middleware
  next();
};


// Export the cors middleware with options
export default cors(corsOptions);
