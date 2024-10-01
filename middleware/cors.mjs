import cors from 'cors';

// Define allowed origins, including environment variables for dynamic domains
const allowedOrigins = [
  `https://${process.env.STORE_DOMAIN}`,
  `https://${process.env.ENDPOINT_DOMAIN}.ondigitalocean.app`,
  // `https://api.bigcommerce.com`
];

export const corsOptions = {
  origin: function (origin, callback) {
    console.log('Incoming origin:', origin);  // Log the incoming origin header

    // Handle requests with no origin (e.g., same-origin or server-to-server)
    if (!origin) {
      console.log('No Origin header found. Allowing request.');
      return callback(null, true);  // Allow the request
    }

    // Log the allowed origins for comparison
    console.log('Allowed origins:', allowedOrigins);

    // Check if the origin is in the allowed list
    if (allowedOrigins.includes(origin)) {
      console.log('Origin allowed:', origin);
      return callback(null, true);  // Allow the request
    }

    // Log the blocked origin
    console.log('Origin not allowed:', origin);
    return callback(new Error('Not allowed by CORS'));  // Block the request
  },
  methods: ['GET', 'POST', 'OPTIONS'],  // Define allowed HTTP methods
  allowedHeaders: ['Content-Type', 'Authorization', 'X-XSRF-TOKEN'],  // Add any custom headers if necessary
  credentials: true  // Allow credentials (cookies, etc.)
};



// // Middleware to set custom CORS headers
// export const setCorsHeaders = (req, res, next) => {
//   const origin = req.headers.origin;

//   // Check if the origin is in the allowed list
//   if (allowedOrigins.includes(origin)) {
//     res.setHeader('Access-Control-Allow-Origin', origin);
//   }

//   // Set headers for CORS support
//   res.setHeader('Access-Control-Allow-Credentials', 'true');
//   res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-XSRF-TOKEN');
//   res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');

//   // Call the next middleware
//   next();
// };

// Export the cors middleware with options
export default cors(corsOptions);
