

// Middleware to manually set CORS headers
// export const setCorsHeaders = (req, res, next) => {
//   const origin = req.headers.origin;

//   // Check if the origin is in the allowed list
//   if (allowedOrigins.includes(origin)) {
//     res.setHeader('Access-Control-Allow-Origin', origin);
//     res.setHeader('Access-Control-Allow-Origin', 'https://connectid-demo-k3.mybigcommerce.com');
//     res.setHeader('Access-Control-Allow-Credentials', 'true');
//     res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-XSRF-TOKEN');
//   }

//   // Set headers for CORS support
//   res.setHeader('Access-Control-Allow-Credentials', 'true');
//   res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-XSRF-TOKEN');
//   res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');

//   // Call the next middleware
//   next();
// };

// Export the CORS middleware
// export default cors(corsOptions);