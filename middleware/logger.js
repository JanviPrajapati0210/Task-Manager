
const fs = require('fs');
const path = require('path');

const LOG_DIR = path.join(__dirname, '..', 'logs');
const LOG_FILE = path.join(LOG_DIR, 'server.log');

if (!fs.existsSync(LOG_DIR)) {
  fs.mkdirSync(LOG_DIR, { recursive: true });
}

function requestLogger(req, res, next) {
  const timestamp = new Date().toISOString();
  const line = `${timestamp} | ${req.method} | ${req.originalUrl} | IP: ${req.ip}`;

  console.log(line);
  
  fs.appendFile(LOG_FILE, line + '\n', (err) => {
    if (err) console.error('Failed to write to log file:', err.message);
  });

  next(); 
}

module.exports = requestLogger;