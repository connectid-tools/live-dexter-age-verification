import express from 'express';
import AWS from 'aws-sdk';
import { getLogger } from '../utils/logger.mjs'; // Import the logger
const logger = getLogger('info');  // Create a logger instance with the desired log level

const router = express.Router();

// Configure AWS SDK for DigitalOcean Spaces
const spacesEndpoint = new AWS.Endpoint('syd1.digitaloceanspaces.com'); // Adjust region accordingly
const s3 = new AWS.S3({
    endpoint: spacesEndpoint,
    accessKeyId: process.env.DO_SPACES_KEY, // Set this in your environment variables
    secretAccessKey: process.env.DO_SPACES_SECRET, // Set this in your environment variables
});

// Function to extract the txn value from authToken
function extractTxnFromAuthToken(authToken) {
    try {
        let parsedToken;

        // Check if authToken is already an object, if not, parse it
        if (typeof authToken === 'object') {
            parsedToken = authToken;
        } else if (typeof authToken === 'string') {
            parsedToken = JSON.parse(authToken);
        } else {
            throw new Error('Invalid authToken format');
        }

        // Check if parsedToken has the decoded property and extract txn
        if (parsedToken.decoded) {
            const decoded = typeof parsedToken.decoded === 'string'
                ? JSON.parse(parsedToken.decoded)
                : parsedToken.decoded;

            return decoded?.txn || null; // Return the txn value if it exists
        }
        return null;
    } catch (error) {
        logger.error('Error extracting txn from authToken:', error);
        return null;
    }
}


// Function to check for duplicate log entries based on txn and orderId
async function checkForDuplicateLog(orderId, txn) {
    const params = {
        Bucket: 'shtransactionlogs',
        Key: `${process.env.DO_SPACES_FILE}`,
    };

    try {
        const existingFile = await s3.getObject(params).promise();
        const existingLog = existingFile.Body.toString('utf-8');

        // Check if an entry with the same orderId and txn exists
        const logEntries = existingLog.split('\n');
        const duplicate = logEntries.some(entry => {
            return entry.includes(`Order ID: ${orderId}`) && entry.includes(`txn: ${txn}`);
        });

        return duplicate;
    } catch (error) {
        if (error.code === 'NoSuchKey') {
            // If no file exists, no duplicate can exist
            return false;
        } else {
            throw new Error('Error reading log file: ' + error.message);
        }
    }
}

// Function to upload log data to DigitalOcean Space
async function uploadLogToSpace(logData) {
    const params = {
        Bucket: 'shtransactionlogs', // Your Space name
        Key: `${process.env.DO_SPACES_FILE}`, // Path to the file in the Space
        Body: logData,
        ContentType: 'text/plain',
        ACL: 'private', // Or 'public-read', depending on your permissions
    };

    try {
        // First, retrieve the existing log file
        const existingFile = await s3.getObject({ Bucket: params.Bucket, Key: params.Key }).promise();
        const existingLog = existingFile.Body.toString('utf-8');

        // Append new log data
        const updatedLog = existingLog + logData;

        // Upload the updated log
        const uploadParams = {
            ...params,
            Body: updatedLog,
        };
        await s3.putObject(uploadParams).promise();
        logger.info('Log appended and uploaded successfully to DigitalOcean Spaces.');
        return true;
    } catch (error) {
        if (error.code === 'NoSuchKey') {
            // If the file doesn't exist, create a new one
            await s3.putObject(params).promise();
            logger.info('Log file created and uploaded successfully to DigitalOcean Spaces.');
            return true;
        } else {
            logger.error('Error uploading log to DigitalOcean Spaces:', error);
            return false;
        }
    }
}

router.post('/', async (req, res) => {
    const { orderId, authToken } = req.body;

    // Return error if authToken or orderId is missing
    if (!orderId || !authToken) {
        return res.status(400).json({ error: 'Missing orderId or authToken' });
    }

    try {
        // Extract the txn value from the authToken
        const txn = extractTxnFromAuthToken(authToken);

        if (!txn) {
            return res.status(400).json({ error: 'Invalid or missing txn in authToken' });
        }

        // Check if the log entry already exists (duplicate check)
        const isDuplicate = await checkForDuplicateLog(orderId, txn);

        if (isDuplicate) {
            logger.info('Duplicate log entry found. Skipping logging.');
            return res.status(200).json({ message: 'Duplicate log entry. No action taken.' });
        }

        // Create a log entry with only txn, orderId, and timestamp
        const logEntry = `Order ID: ${orderId}, txn: ${txn}, Timestamp: ${new Date().toISOString()}\n`;

        // Upload the log entry to DigitalOcean Spaces
        const uploadSuccess = await uploadLogToSpace(logEntry);

        if (uploadSuccess) {
            logger.info('Log entry uploaded successfully.');
            res.status(200).json({ message: 'Order ID, txn, and timestamp logged successfully to DigitalOcean Spaces' });
        } else {
            logger.error('Failed to upload log entry.');
            res.status(500).json({ error: 'Failed to log order and txn.' });
        }
    } catch (error) {
        logger.error('Error logging order and txn:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

export default router;
