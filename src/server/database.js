const mysql = require('mysql')
const fs = require('fs')

const { database } = JSON.parse(fs.readFileSync('settings.json', 'utf-8'))

var pool = mysql.createPool({
  host: database.host,
  port: database.port,
  user: database.user,
  password: database.password,
  database: database.database
})

module.exports = pool