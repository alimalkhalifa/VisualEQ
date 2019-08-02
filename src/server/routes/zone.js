const express = require('express')
const route = express.Router()
const database = require('../database.js')
const loadS3D = require('../loaders/s3d.js')
const fs = require('fs')
const pako = require('pako')
const { WLDParser } = require('../../common/helpers/wldParser')

route.use('/file', express.static('zones'))

route.get('/s3d/:shortname', (req, res) => {
  const wldParser = new WLDParser()
  console.log("Got S3D request")
  
  fs.exists(`./graphics_cache/${req.params.shortname}.bin`, exists => {
    if (exists) {
      console.log('sending cached data')
      fs.readFile(`graphics_cache/${req.params.shortname}.bin`, 'utf-8', (err, data) => {
        //let body = pako.deflate(JSON.stringify(mergeData(JSON.parse(data), JSON.parse(globaldata))), { to: 'string' })
        res.send(data)
        console.log('Sent packet')
      })
    } else {
      loadS3D(`${req.params.shortname}.s3d`, zone => {
        loadS3D(`${req.params.shortname}_obj.s3d`, obj => {
          loadS3D(`${req.params.shortname}_chr.s3d`, chr => {
            fs.readFile('./graphics_cache/globals.json', 'utf-8', (err, globaldata) => {
              wldParser.createScene(zone, obj).then(scene => {
                wldParser.loadChrMeshes([chr]).then(characters => {
                  console.log('sending')
                  let world = {...scene, characters: characters.characters, chrtextures: characters.textures}
                  let body = pako.deflate(JSON.stringify(mergeData(world, JSON.parse(globaldata))), { to: "string", level: 9 })
                  res.send(body)
                  fs.writeFile(`graphics_cache/${req.params.shortname}.bin`, body, err => {
                    if (err) throw new Error(err)
                  })
                })
              })
            })
          })
        })
      })
    }
  })
})

route.get('/s3d_obj/:shortname', (req, res) => {
  console.log("Got S3D_OBJ request")
  loadS3D(`${req.params.shortname}_obj.s3d`, zone => {
    console.log("Sending back S3D_OBJ response")
    res.send(zone)
  })
})

route.get('/s3d_chr/:shortname', (req, res) => {
  console.log("Got S3D_CHR request")
  loadS3D(`${req.params.shortname}_chr.s3d`, chr => {
    console.log("Sending back S3D_CHR response")
    res.send(chr)
  })
})

route.get('/shortname/:shortname', (req, res) => {
  database.getConnection((err, connection) => {
    if (err) {
      throw new Error("Cannot connect to database")
    }
    connection.query(`SELECT * FROM zone WHERE short_name = '${req.params.shortname}'`, (err, zoneInfo) => {
      if (err) throw new Error(err)
      connection.query(`SELECT * FROM spawn2 WHERE zone = '${req.params.shortname}'`, (err, spawn2) => {
        if (err) throw new Error(err)
        let spawngroupIDs = []
        for (let s of spawn2) {
          spawngroupIDs.push(s.spawngroupID)
        }
        connection.query(`SELECT * FROM spawngroup WHERE id IN (${spawngroupIDs})`, (err, spawngroup) => {
          if (err) throw new Error(err)
          connection.query(`SELECT * FROM spawnentry WHERE spawngroupID IN (${spawngroupIDs})`, (err, spawnentry) => {
            if (err) throw new Error(err)
            let npcTypes = []
            for (let s of spawnentry) {
              npcTypes.push(s.npcID)
            }
            connection.query(`SELECT * FROM npc_types WHERE id IN (${npcTypes})`, (err, npcTypes) => {
              if (err) throw new Error(err)
              res.send({
                zoneInfo,
                spawn2,
                spawngroup,
                spawnentry,
                npcTypes
              })
            })
          })
        })
      })
    })
  })
})

route.get('/spawns/:shortname', (req, res) => {
  database.getConnection((err, connection) => {
    if (err) {
      throw new Error("Cannot connect to database")
    }
    connection.query(`SELECT * FROM spawn2 WHERE zone = '${req.params.shortname}'`, (err, results) => {
      if (err) throw err
      res.send(results)
    })
  })
})

function mergeData(d, g) {
  return {
    meshCache: {
      ...d.meshCache,
      ...g.meshCache
    },
    characters: {
      ...d.characters,
      ...g.characters
    },
    chrtextures: {
      ...d.chrtextures,
      ...g.chrtextures
    },
    objectLocations: d.objectLocations,
    objtextures: {
      ...d.objtextures,
      ...g.objtextures
    },
    scene: d.scene,
    textures: d.textures
  }
}

module.exports = route
