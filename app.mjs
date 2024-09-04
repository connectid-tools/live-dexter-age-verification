import dotenv from 'dotenv';
import express from 'express';
import path from 'path';
import cookieParser from 'cookie-parser';
import logger from 'morgan';
import createError from 'http-errors';
import cors from 'cors';

// Import routes
import indexRouter from './routes/index.mjs';
import validateCartRouter from './routes/validateCart.mjs'; // Route for cart validation
import getRestrictedItemsRouter from './routes/getRestrictedItems.mjs'; // Correct path to the route file

// Load environment variables
dotenv.config();

// Initialize Express app
const app = express();
const port = 3001;

// Use CORS middleware
const storeDomain = process.env.STORE_DOMAIN;

app.use(cors({
  origin: [
    `https://${storeDomain}.mybigcommerce.com`, // First allowed domain
  ],
  methods: ['GET', 'POST'],  // Allow these methods
  allowedHeaders: ['Content-Type', 'Authorization'], // Allow these headers
  credentials: true // Allow credentials to be sent with requests
}));

// View engine setup
app.set('views', path.join(path.resolve(), 'views')); // Adjust path joining for ES Modules
app.set('view engine', 'pug');

// Middleware setup
app.use(logger('dev'));
app.use(express.json()); // Parse JSON bodies
app.use(express.urlencoded({ extended: false })); // Parse URL-encoded bodies
app.use(cookieParser());
app.use(express.static(path.join(path.resolve(), 'public'))); // Adjust path joining for ES Modules

// Use routers
app.use('/', indexRouter); // Main router for root path
app.use('/validate-cart', validateCartRouter); // Route for cart validation
app.use('/restricted-items', getRestrictedItemsRouter);

// Catch 404 and forward to error handler
app.use(function(req, res, next) {
  next(createError(404));
});

// Error handler
app.use(function(err, req, res, next) {
  res.locals.message = err.message;
  res.locals.error = req.app.get('env') === 'development' ? err : {};

  const statusCode = err.status || 500;
  console.error(err.stack); // Ensure stack trace is logged for debugging

  res.status(statusCode);
  res.render('error', { error: err });
});

// Start the Express server
app.listen(port, () => {
  console.log(`Server is listening on port ${port}`);
});

export default app; // Use export default instead of module.exports
