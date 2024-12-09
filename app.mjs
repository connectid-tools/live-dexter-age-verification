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
import Redis from 'ioredis';
import connectRedis from 'connect-redis';

export const redisClient = new Redis({
    host: process.env.REDIS_HOST,
    port: process.env.REDIS_PORT,
    password: process.env.REDIS_PASSWORD,
    tls: process.env.REDIS_TLS === 'true' ? {} : undefined, // Use TLS if required
});

// Log Redis connection events
redisClient.on('connect', () => console.log('Connected to Redis successfully.'));
redisClient.on('error', (err) => console.error('Redis connection error:', err));

const app = express();
const port = 3001;


const RedisStore = connectRedis(session);   

app.use(
    session({
        store: new RedisStore({ client: redisClient }),
        secret: process.env.SESSION_SECRET || 'default-secret',
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

app.use((req, res, next) => {
    console.log('Session ID:', req.sessionID);
    console.log('Session Data:', req.session);
    next();
});

// CORS Config
export const corsOptions = {
    origin: function (origin, callback) {
        const allowedOrigins = [`https://${process.env.STORE_DOMAIN}`];
        if (!origin || allowedOrigins.includes(origin)) {
            callback(null, true);
        } else {
            callback(new Error('Not allowed by CORS'));
        }
    },
    credentials: true, // Required for cookies to be sent
};

app.use(cors(corsOptions));

// Middleware setup
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
    }
})();

// // Start Server
// app.listen(port, () => {
//     console.log(`Server listening on port ${port}`);
// });

export default app;
