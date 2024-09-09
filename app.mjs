import dotenv from 'dotenv';
dotenv.config();  // Load the environment variables

import express from 'express';
import path from 'path';
import cookieParser from 'cookie-parser';
import logger from 'morgan';
import createError from 'http-errors';
import cors from 'cors';
import RelyingPartyClientSdk from '@connectid-tools/rp-nodejs-sdk';
import { config } from './config.js';

const rpClient = new RelyingPartyClientSdk(config);

// Import routes
import indexRouter from './routes/index.mjs';
import validateCartRouter from './routes/restrictItems.mjs';
import getRestrictedItemsRouter from './routes/getRestrictedItems.mjs';
import participantsRouter from './routes/participants.mjs';
import selectBankRouter from './routes/select-bank.mjs';
import retrieveTokensRouter from './routes/retrieve-tokens.mjs';

// Initialize Express app
const app = express();
const port = 3001;

// Use CORS middleware
const storeDomain = process.env.STORE_DOMAIN;

app.use(cors({
  origin: [`https://${storeDomain}`],
  methods: ['GET', 'POST'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true
}));

// View engine setup
app.set('views', path.join(path.resolve(), 'views'));
app.set('view engine', 'pug');

// Middleware setup
app.use(logger('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(path.resolve(), 'public')));

// Use routers
app.use('/', indexRouter);
app.use('/validate-cart', validateCartRouter);
app.use('/restricted-items', getRestrictedItemsRouter);

// Add the new routes
app.use('/participants', participantsRouter(rpClient));
app.use('/select-bank', selectBankRouter(rpClient));
app.use('/retrieve-tokens', retrieveTokensRouter(rpClient));

// Catch 404 and forward to error handler
app.use(function(req, res, next) {
  next(createError(404));
});

// Error handler
app.use(function(err, req, res, next) {
  res.locals.message = err.message;
  res.locals.error = req.app.get('env') === 'development' ? err : {};
  const statusCode = err.status || 500;
  console.error(err.stack);
  res.status(statusCode).render('error', { error: err });
});

// Start the Express server
app.listen(port, () => {
  console.log(`Server is listening on port ${port}`);
});

export default app;
