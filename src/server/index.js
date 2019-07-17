const express = require('express')
const app = express()
const port = 5000

const zone = require('./routes/zone')
const spawngroup = require('./routes/spawngroup')
const npc = require('./routes/npc')

app.use('/zone', zone)
app.use('/spawngroup', spawngroup)
app.use('/npc', npc)
app.get('/path', (req, res) => {
  console.log(`Got req ${req}`)
  res.send({test: 1})
})

app.use('/', express.static('./dist'))

app.listen(port, () => {
  console.log(`Server started on port ${port}`)
})