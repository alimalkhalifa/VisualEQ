const mysql = require('mysql')

var pool = mysql.createPool({
  host: 'nas',
  user: 'eqemu',
  password: 'eqemu',
  database: 'peq'
})

module.exports = pool