import dotenv from 'dotenv';
dotenv.config(); // Load environment variables at the very start

import cors from 'cors';
import express from 'express';
import logger from 'morgan';
import { notFoundHandler, errorHandler } from './middleware/errorHandler.mjs';
import indexRouter from './routes/index.mjs';
import validateCartRouter from './routes/restrictItems.mjs';
import getRestrictedItemsRouter from './routes/getRestrictedItems.mjs';
import selectBankRouter from './routes/selectBank.mjs';
import retrieveTokensRouter from './routes/retrieveTokens.mjs';
import logOrderRouter from './routes/logTokenAndOrderId.mjs';
import setCartId from './routes/setCartId.mjs';
import cookieParser from 'cookie-parser';
import session from 'express-session';

// Ensure all environment variables are loaded
const {
    REDIS_HOST,
    REDIS_PORT,
    REDIS_PASSWORD,
    REDIS_TLS,
    SESSION_SECRET,
    STORE_DOMAIN,
} = process.env;

// Initialize Redis client
export const redisClient = createClient({
    socket: {
        host: REDIS_HOST,
        port: REDIS_PORT,
        tls: REDIS_TLS === 'false',
    },
    password: REDIS_PASSWORD,
});

redisClient.on('error', (err) => console.error('Redis Client Error:', err));
redisClient.on('ready', () => console.log('Redis client is ready.'));
redisClient.on('connect', () => console.log('Connected to Redis server.'));

await redisClient.connect();
console.log('Redis connected successfully.');

const app = express();
const port = 3001;

// Initialize RedisStore
const store = new RedisStore({ client: redisClient });

app.use(
    session({
        store,
        secret: SESSION_SECRET || 'default-secret',
        resave: false,
        saveUninitialized: false,
        cookie: {
            secure: process.env.NODE_ENV === 'production', // Set true for HTTPS
            httpOnly: true, // Protect from client-side access
            sameSite: 'None', // Adjust for cross-origin cookies
            maxAge: 3600 * 1000, // 1 hour
        },
    })
);

// CORS Configuration
const corsOptions = {
    origin: function (origin, callback) {
        const allowedOrigins = [`https://${STORE_DOMAIN}`];
        if (!origin || allowedOrigins.includes(origin)) {
            callback(null, true);
        } else {
            callback(new Error('Not allowed by CORS'));
        }
    },
    credentials: true,
};

app.use(cors(corsOptions));

// Middleware
app.use(logger('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());

// Routes
app.use('/', indexRouter);
app.use('/validate-cart', validateCartRouter);
app.use('/restricted-items', getRestrictedItemsRouter);
app.use('/select-bank', selectBankRouter);
app.use('/retrieve-tokens', retrieveTokensRouter);
app.use('/log-order', logOrderRouter);
app.use('/set-cart-id', setCartId);

// Error Handling
app.use(notFoundHandler);
app.use(errorHandler);

// Start Server
(async () => {
    try {
        // Ensure Redis is connected before starting the server
        await redisClient.ping();
        console.log('Redis connection validated.');

        // Start the Express server
        app.listen(port, () => {
            console.log(`Server listening on port ${port}`);
        });
    } catch (error) {
        console.error('Failed to start the server:', error);
        process.exit(1);
    }
})();

export default app;