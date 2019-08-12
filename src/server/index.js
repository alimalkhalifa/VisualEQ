const express = require('express')
const app = express()
const { convertDir } = require('../modules/S3D2glTF')
const port = 5000

const zone = require('./routes/zone')
const spawngroup = require('./routes/spawngroup')
const npc = require('./routes/npc')

app.use('/zone', zone)
app.use('/spawngroup', spawngroup)
app.use('/npc', npc)

app.use('/', express.static('./dist'))
app.use('/static', express.static('./static'))

app.use('/graphics', express.static('graphics'))
convertDir('zones', 'graphics')

app.listen(port, () => {
  console.log(`Server started on port ${port}`)
})