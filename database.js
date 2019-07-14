const mysql = require('mysql')

var connection = mysql.createConnection({
  host: 'localhost',
  user: 'eqemu',
  password: 'eqemu',
  database: 'peq'
})

module.exports = connection