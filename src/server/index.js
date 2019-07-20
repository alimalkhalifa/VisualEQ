const express = require('express')
const app = express()
const fs = require('fs')
const { WLDParser } = require('../common/helpers/wldParser')
var loadS3D = require('./loaders/s3d.js')
const port = 5000

const zone = require('./routes/zone')
const spawngroup = require('./routes/spawngroup')
const npc = require('./routes/npc')

app.use('/zone', zone)
app.use('/spawngroup', spawngroup)
app.use('/npc', npc)

app.use('/', express.static('./dist'))
app.use('/static', express.static('./static'))

console.log("Loading globals")
fs.exists('graphics_cache/globals.json', exists => {
  if (exists) return
  let wldParser = new WLDParser()
  loadS3D(`global_obj.s3d`, obj => {
    loadS3D(`global_chr.s3d`, chr => {
      let meshCache = {}
      for (let i in obj.wld) {
        let wldFrag = obj.wld[i]
        if (wldFrag.type === "StaticModelRef") {
          let meshRef = wldFrag.meshReferences[0]
          let mesh = obj.wld[obj.wld[meshRef].mesh]
          let meshes = []
          for (mesh of wldParser.loadWLDMesh(mesh, meshRef, obj.wld, obj.s3d)) {
            meshes.push(mesh.toJSON())
          }
          meshCache[wldFrag.name] = meshes
        }
      }
      let objtextures = {}
      for (let i in obj.s3d.files) {
        if (i.toLowerCase().indexOf('.bmp') !== -1) {
          objtextures[i] = obj.s3d.files[i]
        }
      }
      wldParser.loadChrMeshes([chr]).then(characters => {
        fs.writeFile('graphics_cache/globals.json', JSON.stringify({
          meshCache,
          objtextures,
          characters: characters.characters,
          chrtextures: characters.textures
        }), err => {
          if (err) throw new Error(err)
        })
      })
    })
  })
})

app.listen(port, () => {
  console.log(`Server started on port ${port}`)
})