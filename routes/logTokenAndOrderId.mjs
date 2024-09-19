import express from 'express';
import fs from 'fs/promises';
import path from 'path';

const router = express.Router();

// Ensure the logs directory exists within the project folder
async function ensureLogsDirectory() {
    const logsDir = path.join(process.cwd(), 'logs'); // Create the 'logs' folder inside the project
    try {
        await fs.mkdir(logsDir, { recursive: true }); // Ensure the directory is created
    } catch (error) {
        console.error('Error creating logs directory:', error);
    }
}

router.post('/log-order', async (req, res) => {
    const { orderId, authToken } = req.body;

    if (!orderId || !authToken) {
        return res.status(400).json({ error: 'Missing orderId or authToken' });
    }

    try {
        // Ensure the logs directory exists
        await ensureLogsDirectory();

        // Convert authToken into a string in case it's not already
        const authTokenString = typeof authToken === 'string' ? authToken : JSON.stringify(authToken);

        // Define the path to the log file in a 'logs' directory within the project
        const logFilePath = path.join(process.cwd(), 'logs', 'txnLogs.txt');  // Now points to './logs/txnLogs.txt'

        // Create a log entry as a new line
        const logEntry = `Order ID: ${orderId}, Auth Token: ${authTokenString}, Timestamp: ${new Date().toISOString()}\n`;

        // Append the log entry to the file (this creates the file if it doesn't exist)
        await fs.appendFile(logFilePath, logEntry);

        // Send a success response
        res.status(200).json({ message: 'Order ID and auth token logged successfully' });
    } catch (error) {
        console.error('Error logging order and token:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

export default router;
