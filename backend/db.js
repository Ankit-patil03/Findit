require('dotenv').config({ quiet: true });
const { Pool } = require('pg');

// Connection details live in .env so the password never sits in the code
const pool = new Pool({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_NAME,
  password: process.env.DB_PASSWORD,
  port: Number(process.env.DB_PORT) || 5432,
});

module.exports = pool;
