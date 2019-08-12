const { convertDir } = require('..')
const express = require('express')
const app = express()

app.use('/graphics', express.static('graphics'))
app.use('/', express.static('src/modules/S3D2glTF/tests/dist'))

app.listen(5000, () => {
  console.log('listening')
})

convertDir('zones', 'graphics')