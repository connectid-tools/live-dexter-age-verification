import cors from 'cors';

// CORS Options for Express
export const corsOptions = {
  origin: `https://${process.env.STORE_DOMAIN}`,  // Use process.env to dynamically set allowed origin
  methods: ['GET', 'POST', 'OPTIONS'],  // Define allowed HTTP methods
  allowedHeaders: ['Content-Type', 'Authorization', 'X-XSRF-TOKEN'],  // Add any custom headers if necessary
  credentials: true  // Allow credentials (cookies, etc.)
};

// Middleware to manually set CORS headers
export const setCorsHeaders = (req, res, next) => {
  const origin = req.headers.origin;

  // Dynamically allow the specific domain from environment variable
  if (origin === `https://${process.env.STORE_DOMAIN}`) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  }

  // Set headers for CORS support
  res.setHeader('Access-Control-Allow-Origin', `https://${process.env.STORE_DOMAIN}`);
  res.setHeader('Access-Control-Allow-Credentials', 'true');  // Required to allow credentials (cookies) to be sent
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-XSRF-TOKEN');
  
  // Call the next middleware
  next();
};

// Export the CORS middleware
export default cors(corsOptions);
