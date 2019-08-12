var express = require('express')
var route = express.Router()
var database = require('../database.js')

route.get('/:id', (req, res) => {
  database.getConnection((err, connection) => {
    if (err) {
      throw new Error("Cannot connect to database")
    }
    connection.query(`SELECT * FROM npc_types WHERE id = '${req.params.id}'`, (err, results) => {
      if (err) throw err
      res.send(results)
      connection.release()
    })
  })
})

module.exports = route
