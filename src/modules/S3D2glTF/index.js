const fs = require('fs')
const jimp = require('jimp')
const THREE = require('three')
const GLTFExporter = require('../GLTFExporter')
const loadS3D = require('./loaders/s3d')
const loadWLD = require('./loaders/wld')

let material = new THREE.MeshBasicMaterial({})

function convertDir(dir, out, highmem) {
  try {
    fs.statSync(out)
  } catch(err) {
    fs.mkdirSync(out)
  }
  fs.readdir(dir, (err, files) => {
    if (err) throw new Error(err)
    let queue = files.filter(val => val.indexOf('.s3d') !== -1)
    processConvertQueue(queue, dir, out, highmem)
  })
}

function processConvertQueue(queue, dir, out, highmem) {
  if (queue.length === 0) return
  if (process.memoryUsage().heapUsed > (highmem ? 4000000000 : 500000000)) {
    setTimeout(() => processConvertQueue(queue, dir, out), 1000)
  } else {
    setImmediate(() => processConvertQueue(queue.slice(1), dir, out))
    let s3d = queue[0]
    let subout = s3d.substr(0, s3d.indexOf('_') !== -1 ? s3d.indexOf('_') : s3d.indexOf('.'))
    convertS3D(`${dir}/${s3d}`, `${out}/${subout}`)
  }
}

async function convertS3D(path, out) {
  let s3dName = out.substr(out.indexOf('/') + 1)
  let type = 'zone'
  if (path.indexOf('_chr') !== -1) type = 'chr'
  else if (path.indexOf('_obj') !== -1) type = 'obj'
  try {
    fs.statSync(out)
  } catch(err) {
    fs.mkdirSync(out)
  }
  let s3d = await loadS3D(path)
  setImmediate(() => extractTextures(s3dName, type, s3d, out))
  switch(type) {
    case 'zone':
      setImmediate(() => convertZoneToglTF(s3dName, s3d, out))
      break
    case 'chr':
      //setImmediate(() => convertChrToglTFs(s3dName, s3d, out))
      break
    case 'obj':
      setImmediate(() => convertObjToglTFs(s3dName, s3d, out))
      break
    default:
      throw new Error('Unknown S3D type')
  }
}

async function extractTextures(name, type, s3d, out) {
  console.log(`Extracting textures for ${name} - ${type}`)
  try {
    fs.statSync(`${out}/textures`)
  } catch(_) {
    fs.mkdirSync(`${out}/textures`)
  }
  for (let fileName in s3d.files) {
    if (fileName.indexOf('.bmp') !== -1) {
      let buf = s3d.files[fileName]
      if (buf.length > 0) {
        jimp.read(buf, (err, bmp) => {
          if (err) {
            fs.writeFileSync(`${out}/textures/${fileName.substr(0, fileName.indexOf('.bmp'))}.dds`, buf, err => {
              if (err) throw new Error(err)
            })
            return
          }
          bmp.write(`${out}/textures/${fileName.substr(0, fileName.indexOf('.bmp'))}.png`)
          if (fileName.indexOf("fire") !== -1) {
            bmp.greyscale((err, grey) => {
              grey.scan(0, 0, grey.bitmap.width, grey.bitmap.height, function(x, y, idx) {
                let val = Math.pow(this.bitmap.data[idx]/255, 1/4) * 255
                this.bitmap.data[idx] = val
                this.bitmap.data[idx+1] = val
                this.bitmap.data[idx+2] = val
              }, (err, newImg) => newImg.write(`${out}/textures/${fileName.substr(0, fileName.indexOf('.bmp'))}_alpha.png`)
              )
            })
          } else {
            let idxTrans = [-1, -1, -1, -1]
            let newTrans = true
            bmp.scan(0, 0, bmp.bitmap.width, bmp.bitmap.height, function(x, y, idx) {
              let idxTuple = [this.bitmap.data[idx], this.bitmap.data[idx+1], this.bitmap.data[idx+2], this.bitmap.data[idx+3]]
              if (newTrans) {
                idxTrans = idxTuple
                newTrans = false
              }
              
              if (
                idxTuple[0] === idxTrans[0] &&
                idxTuple[1] === idxTrans[1] &&
                idxTuple[2] === idxTrans[2] &&
                idxTuple[3] === idxTrans[3]
              ) {
                this.bitmap.data[idx] = 0
                this.bitmap.data[idx+1] = 0
                this.bitmap.data[idx+2] = 0
              } else {
                this.bitmap.data[idx] = 255
                this.bitmap.data[idx+1] = 255
                this.bitmap.data[idx+2] = 255
              }
            }, (err, newImg) => newImg.write(`${out}/textures/${fileName.substr(0, fileName.indexOf('.bmp'))}_alpha.png`)
            )
          }
        })
      }
    }
  }
}

function convertZoneToglTF(zoneName, s3d, out) {
  let doneGif = []
  console.log(`Converting ${zoneName}`)
  let wld = s3d.files[`${zoneName}.wld`]
  let obj = s3d.files['objects.wld']
  let zone = loadWLD(wld)
  let objects = loadWLD(obj)
  let scene = new THREE.Scene()
  let textures = {}
  for (let fragIndex in zone) {
    let fragment = zone[fragIndex]
    if (fragment.type === "Mesh") {
      let meshes = loadWLDMesh(fragment, fragIndex, zone)
      let group = new THREE.Group()
      for (let name in meshes.textures) {
        if (!(name in textures)) {
          textures[name] = meshes.textures[name]
        }
      }
      for (let mesh of meshes.meshes) {
        mesh.userData.levelgeometry = true
        group.add(mesh)
      }
      scene.add(group)
    }
  }
  scene.userData.textures = textures
  let objectLocations = []
  for (let fragIndex in objects) {
    let fragment = objects[fragIndex]
    if (fragment.type === "ObjectLocation") {
      objectLocations.push({
        name: fragment.ref,
        position: [fragment.x,
          fragment.y,
          fragment.z
        ],
        scale: [
          fragment.scaleX,
          fragment.scaleX,
          fragment.scaleY,
        ],
        rot: [
          THREE.Math.degToRad(fragment.rotX / (512/360)),
          THREE.Math.degToRad(fragment.rotY / (512/360)),
          THREE.Math.degToRad(fragment.rotZ / (512/360))
        ]
      })
    }
  }
  scene.userData.objectLocations = objectLocations
  const exporter = new GLTFExporter()
  exporter.parse(scene, gltf => {
    fs.writeFile(`${out}/${zoneName}.gltf`, JSON.stringify(gltf), err => {
      if (err) throw new Error(err)
    })
  }, {
    embedImages: false
  })
}

function convertObjToglTFs(zoneName, s3d, out) {
  console.log(`Converting ${zoneName}_obj`)
  let wld = s3d.files[`${zoneName}_obj.wld`]
  let zone = loadWLD(wld)
  let scene = new THREE.Scene()
  let textures = {}
  for (let fragIndex in zone) {
    let fragment = zone[fragIndex]
    if (fragment.type === "StaticModelRef") {
      let meshRef = fragment.meshReferences[0]
      let meshInfo = zone[zone[meshRef].mesh]
      let group = new THREE.Group()
      if (meshInfo) {
        let meshes = loadWLDMesh(meshInfo, fragIndex, zone)
        for (let name in meshes.textures) {
          if (!(name in textures)) {
            textures[name] = meshes.textures[name]
          }
        }
        for (let mesh of meshes.meshes) {
          mesh.userData.staticobject = true
          group.add(mesh)
        }
      }
      if (group.children.length > 0) {
        group.name = fragment.name
        scene.add(group)
      }
    }
  }
  scene.userData.textures = textures
  const exporter = new GLTFExporter()
  exporter.parse(scene, gltf => {
    fs.writeFile(`${out}/${zoneName}_obj.gltf`, JSON.stringify(gltf), err => {
      if (err) throw new Error(err)
    })
  }, {
    embedImages: false
  })
}

function loadWLDMesh(fragment, fragIndex, wld, skeletonEntries = []) {
  let meshes = []
  let textures = {}
  fragment.textureListRef = wld[fragment.textureList]
  for (let t in fragment.polygonTextures) {
    fragment.polygonTextures[t].texture = wld[fragment.textureListRef.textureInfoRefsList[fragment.polygonTextures[t].textureIndex]]
    let textureInfoRef = wld[fragment.polygonTextures[t].texture.textureInfoRef]
    //console.log(fragment.polygonTextures)
    if (textureInfoRef) {
      fragment.polygonTextures[t].textureInfo = wld[textureInfoRef.textureInfo]
      let texturePathsRef = fragment.polygonTextures[t].textureInfo.texturePaths
      fragment.polygonTextures[t].texturePaths = []
      for (let p of texturePathsRef) {
        fragment.polygonTextures[t].texturePaths.push(wld[p])
      }
    }
  }
  let vertexPiecesCursor = 0
  if (skeletonEntries.length > 0) {
    for (let piece of fragment.vertexPieces) {
      let skelPiece = wld[wld[skeletonEntries[piece.pieceIndex].Fragment1].skeletonPieceTrack]
      for (let i = 0; i < piece.vertexCount; i++) {
        let vertex = fragment.vertices[vertexPiecesCursor]
        let v = new THREE.Vector3(vertex.x, vertex.y, vertex.z).multiplyScalar(1.0 / (1 << fragment.scale))
        v.applyEuler(skelPiece.rot).add(skelPiece.shift)
        v.divideScalar(1.0 / (1 << fragment.scale))
        fragment.vertices[vertexPiecesCursor] = {x: v.x, y: v.y, z: v.z}
        vertexPiecesCursor++
      }
    }
  }
  let polygons = fragment.polygons
  let scale = 1.0 / (1 << fragment.scale)
  let centerX = fragment.centerX
  let centerY = fragment.centerY
  let centerZ = fragment.centerZ
  var geometry = new THREE.BufferGeometry()
  let vertices = []
  let normals = []
  let uvs = []
  let polygonTexCount = 0
  let polygonTexIndex = 0
  for (let i = 0; i < polygons.length; i++) {
    let p = polygons[i]
    let vertex1 = fragment.vertices[p.vertex3]
    let vertex2 = fragment.vertices[p.vertex2]
    let vertex3 = fragment.vertices[p.vertex1]
    let normal1 = new THREE.Vector3().copy(fragment.vertexNormals[p.vertex3]).normalize()
    let normal2 = new THREE.Vector3().copy(fragment.vertexNormals[p.vertex2]).normalize()
    let normal3 = new THREE.Vector3().copy(fragment.vertexNormals[p.vertex1]).normalize()
    let uv1 = fragment.textureCoords[p.vertex3]
    let uv2 = fragment.textureCoords[p.vertex2]
    let uv3 = fragment.textureCoords[p.vertex1]
    vertices.push(
      vertex1.x * scale + centerX, vertex1.y * scale + centerY, vertex1.z * scale + centerZ,
      vertex2.x * scale + centerX, vertex2.y * scale + centerY, vertex2.z * scale + centerZ,
      vertex3.x * scale + centerX, vertex3.y * scale + centerY, vertex3.z * scale + centerZ
    )
    normals.push(
      normal1.x, normal1.y, normal1.z,
      normal2.x, normal2.y, normal2.z,
      normal3.x, normal3.y, normal3.z
    )
    let uvDivisor = 256.0
    if (uv1, uv2, uv3) {
      uvs.push(
        uv1.x / uvDivisor, uv1.z / uvDivisor,
        uv2.x / uvDivisor, uv2.z / uvDivisor,
        uv3.x / uvDivisor, uv3.z / uvDivisor,
      )
    }
    polygonTexCount++
    if (polygonTexCount >= fragment.polygonTextures[polygonTexIndex].polygonCount) {
      geometry.addAttribute('position', new THREE.BufferAttribute(new Float32Array(vertices), 3))
      //geometry.addAttribute('normal', new THREE.BufferAttribute(new Float32Array(normals), 3))
      geometry.addAttribute('uv', new THREE.BufferAttribute(new Float32Array(uvs), 2))
      geometry.computeBoundingBox()
      var mesh = new THREE.Mesh(geometry, material)
      //mesh.userData.textureFile = fragment.polygonTextures[polygonTexIndex].texturePaths ? fragment.polygonTextures[polygonTexIndex].texturePaths[0].files[0].toLowerCase() : null
      let texture = fragment.polygonTextures[polygonTexIndex]
      if (!(texture.texture.name in textures)) {
        textures[texture.texture.name] = texture
      }
      mesh.userData.texture = texture.texture.name // textures[polygonTexIndex]
      meshes.push(mesh)
      geometry = new THREE.BufferGeometry()
      vertices = []
      normals = []
      uvs = []
      polygonTexIndex++
      polygonTexCount = 0
    }
  }
  return { meshes, textures }
}

module.exports = {
  convertDir,
  convertS3D
}