import dotenv from 'dotenv';
dotenv.config();

import express from 'express';
import path from 'path';
import logger from 'morgan';
import { corsOptions, setCorsHeaders } from './middleware/cors.mjs'; // Import CORS middleware
import { notFoundHandler, errorHandler } from './middleware/errorHandler.mjs';
import indexRouter from './routes/index.mjs';
import validateCartRouter from './routes/restrictItems.mjs';
import getRestrictedItemsRouter from './routes/getRestrictedItems.mjs';
import selectBankRouter from './routes/selectBank.mjs';
import retrieveTokensRouter from './routes/retrieveTokens.mjs';
import logOrderRouter from './routes/logTokenAndOrderId.mjs';
import cookieParser from 'cookie-parser';
import { clearCookies } from './utils/cookieUtils.mjs';
// import cors from 'cors'



const app = express();
// app.use(cors())
const port = 3001;

// clear cookies on home page
app.get('/', (_, res) => {
  clearCookies(res)
  res.sendFile(__dirname + '/index.html')
})

// Middleware setup
app.use(logger('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(express.static(path.join(path.resolve(), 'public')));

app.use(cors(corsOptions));
app.use(setCorsHeaders); // Use custom CORS headers
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
