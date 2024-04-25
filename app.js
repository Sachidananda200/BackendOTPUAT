const express = require('express');
const mysql = require('mysql2/promise');
const bodyParser = require('body-parser');
const moment = require('moment');

const app = express();
const port = 3000;

app.use(bodyParser.json());

let dbDetails = null; // Variable to store database details

// Function to create a new database connection pool
async function createPool() {
    try {
        if (!dbDetails) {
            throw new Error('Database details not set');
        }
        const pool = mysql.createPool({
            host: dbDetails.host,
            user: dbDetails.user,
            password: dbDetails.password,
            database: dbDetails.database,
            waitForConnections: true,
            connectionLimit: 10,
            queueLimit: 0
        });

        console.log('Database connection pool created');
        return pool;
    } catch (error) {
        console.log('Error creating database connection pool:', error);
        throw error;
    }
}

// Function to create SMS data table
async function createSmsDataTable(pool) {
    try {
        const connection = await pool.getConnection();
        await connection.query(`
            CREATE TABLE IF NOT EXISTS IGRS_Message (
                sender VARCHAR(255) NOT NULL,
                Messege_time DATETIME NOT NULL,
                message TEXT NOT NULL,
                otp VARCHAR(10),
                user_mobile VARCHAR(20) NOT NULL
            )
        `);
        connection.release();
        console.log('SMS data table created or already exists');
    } catch (error) {
        console.log('Error creating SMS data table:', error);
    }
}

// Endpoint to receive database details from the frontend
app.post('/validate_database', async (req, res) => {
    const { host, user, password, database } = req.body;
    if (!host || !user || !password || !database) {
        return res.status(400).send('Incomplete database details');
    }

    // Store the received database details
    dbDetails = {
        host,
        user,
        password,
        database
    };

    // Try to create a pool with the received database details
    try {
        const pool = await createPool();
        await createSmsDataTable(pool); // Create SMS data table for the new connection
        // If successful, respond with success
        res.status(200).send('Database details validated successfully');
    } catch (error) {
        // If error, respond with error
        res.status(500).send('Error validating database details');
    }
});

// Endpoint to handle receiving SMS data from Flutter app
app.post('/sms', async (req, res) => {
    const { sender, message, message_time, user_mobile } = req.body;
    if (!sender || !message || !message_time || !user_mobile) {
        return res.status(400).send('Incomplete SMS data');
    }

    try {
        // Extract OTP from message
        const otpRegex = /\b\d{4,6}|\b\d{16}\b/;
        const otpMatch = message.match(otpRegex);
        const otp = otpMatch ? otpMatch[0] : null;
        const Messege_time = moment(message_time).format('YYYY/MM/DD HH:mm:ss');
        
        // Get connection pool
        const pool = await createPool();

        // Store data in the database
        const connection = await pool.getConnection();
        await connection.query('INSERT INTO IGRS_Message (sender, Messege_time, message, otp, user_mobile) VALUES (?, ?, ?, ?, ?)', [sender, Messege_time, message, otp, user_mobile]);
        connection.release();

        console.log('SMS data stored successfully');
        res.status(200).send('SMS data stored successfully');
    } catch (error) {
        console.log('Error storing SMS data:', error);
        res.status(500).send('Error storing SMS data');
    }
});

// Start the server
app.listen(port, () => {
    console.log(`Server is running on http://192.168.160.29:${port}`);
});
