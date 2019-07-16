var express = require('express')
var route = express.Router()
var database = require('./database.js')

route.get('/group/:id', (req, res) => {
  database.getConnection((err, connection) => {
    if (err) {
      throw new Error("Cannot connect to database")
    }
    connection.query(`SELECT * FROM spawngroup WHERE id = '${req.params.id}'`, (err, results) => {
      if (err) throw err
      res.send(results)
    })
  })
})

route.get('/entry/:id', (req, res) => {
  database.getConnection((err, connection) => {
    if (err) {
      throw new Error("Cannot connect to database")
    }
    connection.query(`SELECT * FROM spawnentry WHERE spawngroupID = '${req.params.id}'`, (err, results) => {
      if (err) throw err
      res.send(results)
    })
  })
})

module.exports = route
