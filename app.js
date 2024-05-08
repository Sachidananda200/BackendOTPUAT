const express = require('express');
const mysql = require('mysql2/promise');
const bodyParser = require('body-parser');
const moment = require('moment');

const app = express();
const port = 3000;

app.use(bodyParser.json());

let pool; // Declare the connection pool variable

// Function to create a new database connection pool
async function createPool(databaseDetails) {
    try {
        pool = await mysql.createPool({
            host: databaseDetails.host,
            user: databaseDetails.user,
            password: databaseDetails.password,
            database: databaseDetails.database,
            waitForConnections: true,
            connectionLimit: 10,
            queueLimit: 0
        });
        console.log('Database connection pool created');
    } catch (error) {
        console.log('Error creating database connection pool:', error);
        throw error;
    }
}
// Call function to create the connection pool during server startup
createPool();

// Function to create SMS data table
async function createSmsDataTable() {
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
// Call function to create SMS data table when server starts up
createSmsDataTable();


// Endpoint to receive database details from the frontend and create connection pool
app.post('/validate_database', async (req, res) => {
    const databaseDetails = req.body;
    if (!databaseDetails.host || !databaseDetails.user || !databaseDetails.password || !databaseDetails.database) {
        return res.status(400).send('Incomplete database details');
    }

    try {
        // Create connection pool with received details
        await createPool(databaseDetails);
        // Create SMS data table
        await createSmsDataTable();
        res.status(200).send('Database details validated successfully');
    } catch (error) {
        console.log('Error validating database details:', error);
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
        // Get connection from pool
        const connection = await pool.getConnection();
        // Extract OTP from message
        const otpRegex = /\b\d{4,6}|\b\d{16}\b/;
        const otpMatch = message.match(otpRegex);
        const otp = otpMatch ? otpMatch[0] : null;
        const Messege_time = moment(message_time).format('YYYY/MM/DD HH:mm:ss');

        console.log(sender, Messege_time, otp, user_mobile, message); // Log the received SMS data

        // Store data in the database
        await connection.query('INSERT INTO IGRS_Message (sender, Messege_time, message, otp, user_mobile) VALUES (?, ?, ?, ?, ?)', [sender, Messege_time, message, otp, user_mobile]);
        
        // Release connection back to pool
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
