import express from 'express';
import AWS from 'aws-sdk';

const router = express.Router();

// Configure AWS SDK for DigitalOcean Spaces
const spacesEndpoint = new AWS.Endpoint('syd1.digitaloceanspaces.com'); // Adjust region accordingly
const s3 = new AWS.S3({
    endpoint: spacesEndpoint,
    accessKeyId: process.env.SPACES_KEY, // Set this in your environment variables
    secretAccessKey: process.env.SPACES_SECRET, // Set this in your environment variables
});

// Function to check for duplicate log entries
async function checkForDuplicateLog(orderId, authToken) {
    const params = {
        Bucket: 'shtransactionlogs',
        Key: 'sh-demo-txn-logs/txnLogs.txt',
    };

    try {
        const existingFile = await s3.getObject(params).promise();
        const existingLog = existingFile.Body.toString('utf-8');

        // Check if an entry with the same orderId and authToken exists
        const logEntries = existingLog.split('\n');
        const duplicate = logEntries.some(entry => {
            return entry.includes(`Order ID: ${orderId}`) && entry.includes(`Auth Token: ${authToken}`);
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
        Key: 'sh-demo-txn-logs/txnLogs.txt', // Path to the file in the Space
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
        console.log('Log appended and uploaded successfully to DigitalOcean Spaces.');
        return true;
    } catch (error) {
        if (error.code === 'NoSuchKey') {
            // If the file doesn't exist, create a new one
            await s3.putObject(params).promise();
            console.log('Log file created and uploaded successfully to DigitalOcean Spaces.');
            return true;
        } else {
            console.error('Error uploading log to DigitalOcean Spaces:', error);
            return false;
        }
    }
}

router.post('/log-order', async (req, res) => {
    const { orderId, authToken } = req.body;

    // Return error if authToken or orderId is missing
    if (!orderId || !authToken) {
        return res.status(400).json({ error: 'Missing orderId or authToken' });
    }

    try {
        // Check if the log entry already exists (duplicate check)
        const isDuplicate = await checkForDuplicateLog(orderId, authToken);

        if (isDuplicate) {
            console.log('Duplicate log entry found. Skipping logging.');
            return res.status(200).json({ message: 'Duplicate log entry. No action taken.' });
        }

        // Convert authToken into a string in case it's not already
        const authTokenString = typeof authToken === 'string' ? authToken : JSON.stringify(authToken);

        // Create a log entry as a new line
        const logEntry = `Order ID: ${orderId}, Auth Token: ${authTokenString}, Timestamp: ${new Date().toISOString()}\n`;

        // Upload the log entry to DigitalOcean Spaces
        const uploadSuccess = await uploadLogToSpace(logEntry);

        if (uploadSuccess) {
            console.log('Log entry uploaded successfully.');
            res.status(200).json({ message: 'Order ID and auth token logged successfully to DigitalOcean Spaces' });
        } else {
            console.error('Failed to upload log entry.');
            res.status(500).json({ error: 'Failed to log order and token.' });
        }
    } catch (error) {
        console.error('Error logging order and token:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

export default router;
