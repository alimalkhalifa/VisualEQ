var express = require('express')
var route = express.Router()
var database = require('./database.js')

route.use('/file', express.static('zones'))

route.get('/shortname/:shortname', (req, res) => {
  database.query(`SELECT * FROM zone WHERE short_name = '${req.params.shortname}'`, (err, results) => {
    if (err) throw err
    res.send(results)
  })
})

route.get('/spawns/:shortname', (req, res) => {
  database.query(`SELECT * FROM spawn2 WHERE zone = '${req.params.shortname}'`, (err, results) => {
    if (err) throw err
    res.send(results)
  })
})

module.exports = route
