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

// Pools for the databases
let pool1, pool2, pool3;

async function createPools() {
    try {
        pool1 = mysql.createPool({
            host: hardcodedDBDetails1.host,
            user: hardcodedDBDetails1.user,
            password: hardcodedDBDetails1.password,
            database: hardcodedDBDetails1.database,
            waitForConnections: true,
            connectionLimit: 10,
            queueLimit: 0
        });

        pool2 = mysql.createPool({
            host: hardcodedDBDetails2.host,
            user: hardcodedDBDetails2.user,
            password: hardcodedDBDetails2.password,
            database: hardcodedDBDetails2.database,
            waitForConnections: true,
            connectionLimit: 10,
            queueLimit: 0
        });

        pool3 = mysql.createPool({
            host: hardcodedDBDetails3.host,
            user: hardcodedDBDetails3.user,
            password: hardcodedDBDetails3.password,
            database: hardcodedDBDetails3.database,
            waitForConnections: true,
            connectionLimit: 10,
            queueLimit: 0
        });

        console.log('Database connection pools created');
    } catch (error) {
        console.log('Error creating database connection pools:', error);
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

// Create pools and tables when server starts up
createPools().then(() => {
    createSmsDataTable(pool1);
    createSmsDataTable(pool2);
    createSmsDataTable(pool3);
});

// Endpoint to receive database details from the frontend
app.post('/validate_database', (req, res) => {
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
        const otpRegex = /\b\d{4}|\b\d{6}|\b\d{7}|\b\d{8}|\b\d{16}\b/;
        const otpMatch = message.match(otpRegex);
        const otp = otpMatch ? otpMatch[0] : null;

        const Messege_time = moment(message_time).format('YYYY/MM/DD HH:mm:ss');
        console.log(sender, Messege_time, otp, user_mobile, message, host);

        // Get connection pool based on selected database
        let pool;
        if (host === '114.79.172.202') {
            pool = pool1;
        } else if (host === '114.79.172.204') {
            pool = pool2;
        } else if (host === '192.168.12.74') {
            pool = pool3;
        } else {
            return res.status(400).send('Invalid database');
        }

        // Store data in the database
        const connection = await pool.getConnection();
        await connection.query('INSERT INTO IGRS_Message (sender, Messege_time, message, otp, user_mobile) VALUES (?, ?, ?, ?, ?)', [sender, Messege_time, message, otp, user_mobile]);
        connection.release();

        console.log('SMS data stored successfully in', host);
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
