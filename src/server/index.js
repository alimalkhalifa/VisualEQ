const express = require('express')
const app = express()
const { convertDir } = require('../modules/S3D2glTF')
const port = 5000

const zone = require('./routes/zone')
const spawngroup = require('./routes/spawngroup')
const npc = require('./routes/npc')

let flags = {
  highmem: false,
  skipconvert: false
}

app.use('/zone', zone)
app.use('/spawngroup', spawngroup)
app.use('/npc', npc)

app.use('/', express.static('./dist'))
app.use('/static', express.static('./static'))

app.use('/graphics', express.static('graphics'))
process.argv.forEach(val=> {
  if (val === '--highmem') flags.highmem = true
  if (val === '--skip-convert') flags.skipconvert = true
})
if (!flags.skipconvert) {
  convertDir('zones', 'graphics', flags.highmem)
}

app.listen(port, () => {
  console.log(`Server started on port ${port}`)
})