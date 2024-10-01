import dotenv from 'dotenv';
dotenv.config();

import express from 'express';
import path from 'path';
import logger from 'morgan';
import cors, { corsOptions, allowedOrigins } from './middleware/cors.mjs';
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

app.use((req, res, next) => {
  console.log('Request Headers:', req.headers);
  next();
});

// Log environment variables and allowedOrigins
console.log('STORE_DOMAIN:', process.env.STORE_DOMAIN);
console.log('ENDPOINT_DOMAIN:', process.env.ENDPOINT_DOMAIN);
console.log('Allowed Origins:', allowedOrigins);


// Middleware setup
app.use(logger('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(express.static(path.join(path.resolve(), 'public')));

// Apply CORS middleware with options before routes
app.use(cors(corsOptions));      // <-- Ensure CORS is applied here
app.use(cookieParser());

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
