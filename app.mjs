import dotenv from 'dotenv';
dotenv.config();

import express from 'express';
import path from 'path';
import logger from 'morgan';
import cors, { setCorsHeaders } from './middleware/cors.mjs';
import { notFoundHandler, errorHandler } from './middleware/errorHandler.mjs';
import indexRouter from './routes/index.mjs';
import validateCartRouter from './routes/restrictItems.mjs';
import getRestrictedItemsRouter from './routes/getRestrictedItems.mjs';
import selectBankRouter from './routes/selectBank.mjs';
import retrieveTokensRouter from './routes/retrieveTokens.mjs';
import logOrderRouter from './routes/logTokenAndOrderId.mjs';
import cookieParser from 'cookie-parser';
import { getLogger } from '../utils/logger.mjs'; // Import the logger

const logger = getLogger('info');  // Create a logger instance with the desired log level

const app = express();
const port = 3001;

// Middleware setup
app.use(logger('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(express.static(path.join(path.resolve(), 'public')));
app.use(cors);
app.use(setCorsHeaders);
app.use(cookieParser());

// Routes
app.use('/', indexRouter);
app.use('/validate-cart', validateCartRouter);
app.use('/restricted-items', getRestrictedItemsRouter);
app.use('/select-bank', selectBankRouter);
app.use('/retrieve-tokens', retrieveTokensRouter);
app.use('/log-order', logOrderRouter);


// Token management

// Error handling
app.use(notFoundHandler);
app.use(errorHandler);

// Start server
app.listen(port, () => {
  logger.log(`Server listening on port ${port}`);
});

export default app;