import dotenv from 'dotenv';
dotenv.config(); // Load environment variables at the very start

import cors from 'cors';
import express from 'express';
import path from 'path';
import logger from 'morgan';
import { notFoundHandler, errorHandler } from './middleware/errorHandler.mjs';
import indexRouter from './routes/index.mjs';
import validateCartRouter from './routes/restrictItems.mjs';
import getRestrictedItemsRouter from './routes/getRestrictedItems.mjs';
import selectBankRouter from './routes/selectBank.mjs';
import retrieveTokensRouter from './routes/retrieveTokens.mjs';
import logOrderRouter from './routes/logTokenAndOrderId.mjs';
import cookieParser from 'cookie-parser';

const app = express();
const port = 3001;
// Define allowed origins, including environment variables for dynamic domains
const allowedOrigins = [
  `https://${process.env.STORE_DOMAIN}`, // e.g., connectid-demo-k3.mybigcommerce.com
  // `https://${process.env.ENDPOINT_DOMAIN}.ondigitalocean.app`, // e.g., sh-checkout-validator-qud6t.ondigitalocean.app
];

console.log('Allowed origins:', allowedOrigins.join(', '));  // Log allowed origins

// CORS Options for Express
export const corsOptions = {
  origin: function (origin, callback) {
    // Log the incoming origin for debugging purposes
    console.log('Incoming request from origin:', origin);

    // Allow requests with no origin (e.g., server-to-server, Postman) or match the allowed origins
    if (!origin || allowedOrigins.includes(origin)) {
      console.log('CORS allowed for origin:', origin);  // Log the incoming origin that is allowed
      callback(null, true);  // Allow the request
    } else {
      console.error('CORS denied for origin:', origin);  // Log denied origins
      callback(new Error('Not allowed by CORS'));  // Block the request
    }
  },
  credentials: true,  // Allow credentials (cookies, etc.)
  methods: ['GET', 'POST', 'OPTIONS'],  // Allow specific HTTP methods
  allowedHeaders: ['Content-Type', 'Authorization', 'X-XSRF-TOKEN'],  // Specify the allowed headers
};

app.use(cors(corsOptions)); // Use custom CORS headers


// Middleware setup
app.use(logger('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(express.static(path.join(path.resolve(), 'public')));

// Apply CORS middleware with options before routes
app.use(cookieParser());  // Parse cookies for session handling

// Routes
app.use('/', indexRouter);
app.use('/validate-cart', validateCartRouter);
app.use('/restricted-items', getRestrictedItemsRouter);
app.use('/select-bank', selectBankRouter);
app.use('/retrieve-tokens', retrieveTokensRouter);
app.use('/log-order', logOrderRouter);

// Error handling
app.use(notFoundHandler);
app.use(errorHandler);

// Start server
app.listen(port, () => {
  console.log(`Server listening on port ${port}`);
});

export default app;
