const express = require('express')
const app = express()
const port = 5000

const database = require('./database.js')
const zone = require('./zone.js')
const spawngroup = require('./spawngroup.js')
const npc = require('./npc.js')

app.use('/zone', zone)
app.use('/spawngroup', spawngroup)
app.use('/npc', npc)
app.get('/path', (req, res) => {
  console.log(`Got req ${req}`)
  res.send({test: 1})
})

app.use('/', express.static('dist'))

app.listen(port, () => {
  console.log(`Server started on port ${port}`)
  database.connect(err => {
    if (err) {
      console.error(`Error connecting to database: ${err.stack}`)
      return
    }
    console.log(`Connected to database on thread ${database.threadId}`)
  })
})