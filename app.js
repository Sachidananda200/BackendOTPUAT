const express = require('express');
const mysql = require('mysql2/promise');
const bodyParser = require('body-parser');
const moment = require('moment');

const app = express();
const port = 3000;

app.use(bodyParser.json());

let pool; // Database connection pool

// Function to create a new database connection pool
async function createPool(dbDetails) {
    try {
        if (!dbDetails) {
            throw new Error('Database details not set');
        }
        pool = mysql.createPool({
            host: dbDetails.host,
            user: dbDetails.user,
            password: dbDetails.password,
            database: dbDetails.database,
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

// Endpoint to receive database details from the frontend
app.post('/validate_database', async (req, res) => {
    const { host, user, password, database } = req.body;
    if (!host || !user || !password || !database) {
        return res.status(400).send('Incomplete database details');
    }

    // Store the received database details
    const dbDetails = {
        host,
        user,
        password,
        database
    };

    // Try to create a pool with the received database details
    try {
        await createPool(dbDetails);
        await createSmsDataTable(); // Create SMS data table for the new connection
        // If successful, respond with success
        res.status(200).send('Database details validated successfully');
    } catch (error) {
        // If error, respond with error
        res.status(500).send('Error validating database details');
    }
});

// Endpoint to handle receiving SMS data from Flutter app
app.post('/sms', async (req, res) => {
    const { sender, message, message_time, user_mobile, selected_db } = req.body;
    if (!sender || !message || !message_time || !user_mobile || !selected_db) {
        return res.status(400).send('Incomplete SMS data');
    }

    try {
        if (!pool) {
            throw new Error('Database connection pool not initialized');
        }

        // Extract OTP from message
        const otpRegex = /\b\d{4,6}|\b\d{16}\b/;
        const otpMatch = message.match(otpRegex);
        const otp = otpMatch ? otpMatch[0] : null;
        const Messege_time = moment(message_time).format('YYYY/MM/DD HH:mm:ss');

        // Get connection from the pool
        const connection = await pool.getConnection();

        // Determine the table name based on the selected database
        let tableName;
        switch (selected_db) {
            case 'SBI':
                tableName = 'IGRS_Message';
                break;
            case 'NonSBI':
                tableName = 'NonSBI_Message';
                break;
            case 'AXIS':
                tableName = 'AXIS_Message';
                break;
            case 'NewDB':
                tableName = 'NewDB_Message';
                break;
            default:
                return res.status(400).send('Invalid selected database name');
        }

        // Insert SMS data into the appropriate table
        await connection.query(`INSERT INTO ${tableName} (sender, Messege_time, message, otp, user_mobile) VALUES (?, ?, ?, ?, ?)`, [sender, Messege_time, message, otp, user_mobile]);

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
