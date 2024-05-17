const express = require('express');
const mysql = require('mysql2/promise');
const bodyParser = require('body-parser');
const moment = require('moment');

const app = express();
const port = 3000;

app.use(bodyParser.json());

// Hardcoded database details for three databases
const hardcodedDBDetails1 = {
    host: '114.79.172.202',
    user: 'root',
    password: 'Apmosys@123',
    database: 'test' // Change database name as needed
};

const hardcodedDBDetails2 = {
    host: '114.79.172.204',
    user: 'apmosys',
    password: 'Apmosys@123',
    database: 'test' // Change database name as needed
};

const hardcodedDBDetails3 = {
    host: '192.168.12.74',
    user: 'admin',
    password: 'Apmosys@123',
    database: 'test' // Change database name as needed
};

// Function to create a new database connection pool
async function createPool(dbDetails) {
    try {
        return mysql.createPool({
            host: dbDetails.host,
            user: dbDetails.user,
            password: dbDetails.password,
            database: dbDetails.database,
            waitForConnections: true,
            connectionLimit: 10,
            queueLimit: 0
        });
    } catch (error) {
        console.error(`Error creating pool for ${dbDetails.host}:`, error);
        throw error;
    }
}

// Create connection pools for each hardcoded database
const pools = {
    '114.79.172.202': createPool(hardcodedDBDetails1),
    '114.79.172.204': createPool(hardcodedDBDetails2),
    '192.168.12.74': createPool(hardcodedDBDetails3),
};

// Function to create SMS data table
async function createSmsDataTable(pool) {
    let connection;
    try {
        connection = await pool.getConnection();
        await connection.query(`
            CREATE TABLE IF NOT EXISTS IGRS_Message (
                sender VARCHAR(255) NOT NULL,
                Messege_time DATETIME NOT NULL,
                message TEXT NOT NULL,
                otp VARCHAR(10),
                user_mobile VARCHAR(20) NOT NULL
            )
        `);
        console.log('SMS data table created or already exists');
    } catch (error) {
        console.error('Error creating SMS data table:', error);
    } finally {
        if (connection) connection.release();
    }
}

// Initialize tables once all pools are created
async function initializeTables() {
    try {
        const poolValues = await Promise.all(Object.values(pools));
        for (const pool of poolValues) {
            await createSmsDataTable(pool);
        }
    } catch (error) {
        console.error('Error initializing tables:', error);
    }
}
initializeTables();

// Endpoint to receive database details from the frontend
app.post('/validate_database', async (req, res) => {
    const { host, user, password, database } = req.body;
    if (!host || !user || !password || !database) {
        return res.status(400).send('Incomplete database details');
    }

    // Compare incoming details with hardcoded ones
    if (
        !(
            (host === hardcodedDBDetails1.host && user === hardcodedDBDetails1.user &&
                password === hardcodedDBDetails1.password && database === hardcodedDBDetails1.database) ||
            (host === hardcodedDBDetails2.host && user === hardcodedDBDetails2.user &&
                password === hardcodedDBDetails2.password && database === hardcodedDBDetails2.database) ||
            (host === hardcodedDBDetails3.host && user === hardcodedDBDetails3.user &&
                password === hardcodedDBDetails3.password && database === hardcodedDBDetails3.database)
        )
    ) {
        return res.status(403).send('Invalid database details');
    }

    res.status(200).send('Database details validated successfully');
});

// Endpoint to handle receiving SMS data from Flutter app
app.post('/sms', async (req, res) => {
    const { sender, message, message_time, user_mobile, host } = req.body;
    if (!sender || !message || !message_time || !user_mobile || !host) {
        return res.status(400).send('Incomplete SMS data');
    }

    try {
        // Extract OTP from message
        const otpRegex = /\b\d{4}\b|\b\d{6}\b|\b\d{7}\b|\b\d{8}\b|\b\d{16}\b/;
        const otpMatch = message.match(otpRegex);
        const otp = otpMatch ? otpMatch[0] : null;

        const Messege_time = moment(message_time).format('YYYY/MM/DD HH:mm:ss');
        console.log(sender, Messege_time, otp, user_mobile, message, host);

        // Get connection pool based on selected database
        const pool = await pools[host];
        if (!pool) {
            return res.status(400).send('Invalid database');
        }

        // Store data in the database
        const connection = await pool.getConnection();
        try {
            await connection.query('INSERT INTO IGRS_Message (sender, Messege_time, message, otp, user_mobile) VALUES (?, ?, ?, ?, ?)', [sender, Messege_time, message, otp, user_mobile]);
            console.log('SMS data stored successfully in', host);
            res.status(200).send('SMS data stored successfully');
        } finally {
            connection.release();
        }
    } catch (error) {
        console.error('Error storing SMS data:', error);
        res.status(500).send('Error storing SMS data');
    }
});

// Start the server
app.listen(port, () => {
    console.log(`Server is running on http://192.168.160.29:${port}`);
});
