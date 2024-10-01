import cors from 'cors';

// Define allowed origins, including environment variables for dynamic domains
const allowedOrigins = [
  `https://${process.env.STORE_DOMAIN}`, // e.g., connectid-demo-k3.mybigcommerce.com
  `https://${process.env.ENDPOINT_DOMAIN}.ondigitalocean.app`, // e.g., sh-checkout-validator-qud6t.ondigitalocean.app
  `https://api.bigcommerce.com` // BigCommerce API
];

// CORS Options for Express
export const corsOptions = {
  origin: function (origin, callback) {
    // Allow requests with no origin (e.g., server-to-server, Postman) or match the allowed origins
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true); // Allow the request
    } else {
      callback(new Error('Not allowed by CORS')); // Block the request
    }
  },
  methods: ['GET', 'POST', 'OPTIONS'], // Define allowed HTTP methods
  allowedHeaders: ['Content-Type', 'Authorization', 'X-XSRF-TOKEN'], // Add any custom headers if necessary
  credentials: true // Allow credentials (cookies, etc.)
};

// Middleware to manually set CORS headers
export const setCorsHeaders = (req, res, next) => {
  const origin = req.headers.origin;

  // Check if the origin is in the allowed list
  if (allowedOrigins.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  }

  // Set headers for CORS support
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-XSRF-TOKEN');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');

  // Call the next middleware
  next();
};

// Export the CORS middleware
export default cors(corsOptions);
