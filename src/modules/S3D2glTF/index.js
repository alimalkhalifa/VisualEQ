const fs = require('fs')
const jimp = require('jimp')
const THREE = require('three')
const GLTFExporter = require('../GLTFExporter')
const loadS3D = require('./loaders/s3d')
const loadWLD = require('./loaders/wld')
const { Image } = require('canvas')

function convertDir(dir, out, highmem) {
  try {
    fs.statSync(out)
  } catch(err) {
    console.log("out dir not found")
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
  if (type === "chr") {
    out = 'graphics/characters'
  }
  try {
    fs.statSync(out)
  } catch(err) {
    console.error('out dir not found')
    fs.mkdirSync(out)
  }
  let s3d = await loadS3D(path)
  setImmediate(() => extractTextures(s3dName, type, s3d, out))
  switch(type) {
    case 'zone':
      setImmediate(() => convertZoneToglTF(s3dName, s3d, out))
      break
    case 'chr':
      setImmediate(() => convertChrToglTFs(s3dName, s3d, out))
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
    console.error('out dir not found')
    fs.mkdirSync(`${out}/textures`)
  }
  for (let fileName in s3d.files) {
    if (fileName.indexOf('.bmp') !== -1) {
      let buf = s3d.files[fileName]
      if (buf.length > 0) {
        jimp.read(buf, (err, bmp) => {
          if (err) {
            console.log(err)
            fs.writeFileSync(`${out}/textures/${fileName.substr(0, fileName.indexOf('.bmp'))}.dds`, buf, err => {
              if (err) throw new Error(err)
            })
            return
          }
          bmp.write(`${out}/textures/${fileName.substr(0, fileName.indexOf('.bmp'))}.png`)
          if (fileName.indexOf("fire") !== -1) {
            bmp.scan(0, 0, bmp.bitmap.width, bmp.bitmap.height, function(x, y, idx) {
              let hsl = {}
              hsl = new THREE.Color(this.bitmap.data[idx]/255, this.bitmap.data[idx+1]/255, this.bitmap.data[idx+2]/255).getHSL(hsl)
              let val = Math.pow(hsl.l, 1/4) * 255
              this.bitmap.data[idx+3] = val
            }, (err, newImg) => {
              if (err) throw new Error(err)
              return newImg.write(`${out}/textures/${fileName.substr(0, fileName.indexOf('.bmp'))}_alpha.png`)
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
                this.bitmap.data[idx+3] = 0
              } else {
                this.bitmap.data[idx+3] = 255
              }
            }, (err, newImg) => {
              if (err) throw new Error(err)
              newImg.write(`${out}/textures/${fileName.substr(0, fileName.indexOf('.bmp'))}_alpha.png`)
            })
          }
        })
      }
    }
  }
}

function convertZoneToglTF(zoneName, s3d, out) {
  console.log(`Converting ${zoneName}`)
  let wld = s3d.files[`${zoneName}.wld`]
  let obj = s3d.files['objects.wld']
  let zone = loadWLD(wld)
  let objects = loadWLD(obj)
  let scene = new THREE.Scene()
  let materialCache = {}
  let imageCache = {}
  for (let fragIndex in zone) {
    let fragment = zone[fragIndex]
    if (fragment.type === "Mesh") {
      let mesh = loadWLDMesh(fragment, zone, materialCache, imageCache)
      scene.add(mesh)
    }
  }
  let objectLocations = []
  for (let fragIndex in objects) {
    let fragment = objects[fragIndex]
    if (fragment.type === "ObjectLocation") {
      objectLocations.push({
        name: fragment.ref,
        position: [
          fragment.x,
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
    fs.writeFile(`${out}/${zoneName}.glb`, Buffer.from(gltf), err => {
      if (err) throw new Error(err)
    })
  }, {
    embedImages: false,
    binary: true
  })
}

function convertObjToglTFs(zoneName, s3d, out) {
  console.log(`Converting ${zoneName}_obj`)
  let wld = s3d.files[`${zoneName}_obj.wld`]
  let zone = loadWLD(wld)
  let scene = new THREE.Scene()
  let materialCache = {}
  let imageCache = {}
  for (let fragIndex in zone) {
    let fragment = zone[fragIndex]
    if (fragment.type === "StaticModelRef") {
      let meshRef = fragment.meshReferences[0]
      let meshInfo = zone[zone[meshRef].mesh]
      if (meshInfo) {
        let mesh = loadWLDMesh(meshInfo, zone, materialCache, imageCache)
        mesh.name = fragment.name
        scene.add(mesh)
      }
    }
  }
  const exporter = new GLTFExporter()
  exporter.parse(scene, gltf => {
    fs.writeFile(`${out}/${zoneName}_obj.glb`, Buffer.from(gltf), err => {
      if (err) throw new Error(err)
    })
  }, {
    embedImages: false,
    binary: true
  })
}

function convertChrToglTFs(zoneName, s3d, out) {
  console.log(`Converting ${zoneName}_chr`)
  let wld = s3d.files[`${zoneName}_chr.wld`]
  let zone = loadWLD(wld)
  let materialCache = {}
  let imageCache = {}
  for (let fragIndex in zone) {
    let fragment = zone[fragIndex]
    if (fragment.type === "StaticModelRef") {
      let raceCode = fragment.name.substr(0, fragment.name.indexOf('_'))
      //console.log(`Loading ${raceCode}`)
      let skeletonFragment = zone[zone[fragment.meshReferences[0]].skeletonTrack]
      let entries = skeletonFragment ? skeletonFragment.entries : []
      if (entries.length > 0) {
        let stem = entries[0]
        walkSkeleton(zone, entries, stem)
      }
      let scene = new THREE.Scene()
      let group = new THREE.Group()
      group.name = raceCode
      for (let i = 0; i < Object.keys(zone).length; i++) {
        let f = zone[i]
        if (f.type === "Mesh" && f.name.indexOf(raceCode) !== -1) {
          let helmchr = f.name.substr(3, f.name.indexOf('_') - 3)
          let helm = helmchr.length == 0 ? "BASE" : helmchr.indexOf("HE") !== -1 ? helmchr : `BO${helmchr}`
          let mesh =  loadWLDMesh(f, zone, materialCache, imageCache, entries)
          mesh.userData.helm = helm
          group.add(mesh)
        }
      }
      scene.add(group)
      const exporter = new GLTFExporter()
      exporter.parse(scene, gltf => {
        fs.writeFile(`${out}/${raceCode}.glb`, Buffer.from(gltf), err => {
          if (err) throw new Error(err)
        })
      }, {
        embedImages: false,
        binary: true
      })
    }
  }
}

function loadWLDMesh(fragment, wld, materialCache, imageCache, skeletonEntries = []) {
  fragment.textureListRef = wld[fragment.textureList]
  for (let t in fragment.polygonTextures) {
    fragment.polygonTextures[t].texture = wld[fragment.textureListRef.textureInfoRefsList[fragment.polygonTextures[t].textureIndex]]
    let textureInfoRef = wld[fragment.polygonTextures[t].texture.textureInfoRef]
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
      // console.log(skelPiece) // ANIMATION DEBUG
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
  let scale = 1.0 / (1 << fragment.scale)
  let centerX = fragment.centerX
  let centerY = fragment.centerY
  let centerZ = fragment.centerZ
  var geometry = new THREE.BufferGeometry()
  let vertices = []
  let normals = []
  let uvs = []
  let colors = []
  let indices = []
  for (let v of fragment.vertices) {
    vertices.push(v.x * scale + centerX, v.y * scale + centerY, v.z * scale + centerZ)
  }
  for (let n of fragment.vertexNormals) {
    normals.push(n.x, n.y, n.z)
  }
    let uvDivisor = 256.0
  if (fragment.texCoordsCount > 0) {
    for (let u of fragment.textureCoords) {
      uvs.push(u.x / uvDivisor, -u.z / uvDivisor)
    }
  }
  if (fragment.colorCount > 0) {
    for (let cHex of fragment.vertexColors) {
      let c = new THREE.Color(cHex)
      colors.push(c.r, c.g, c.b)
    }
  }
  for (let p of fragment.polygons) {
    indices.push(p.vertex3, p.vertex2, p.vertex1)
  }
  geometry.setIndex(indices)
  geometry.addAttribute('position', new THREE.Float32BufferAttribute(vertices, 3))
  geometry.addAttribute('normal', new THREE.Float32BufferAttribute(normals, 3))
  geometry.addAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2))
  //if (colors.length > 0) geometry.addAttribute('color', new THREE.Float32BufferAttribute(colors, 3))
  geometry.normalizeNormals()
  let groupStart = 0
  let textures = []
  for (let i = 0; i < fragment.polygonTexCount; i++) {
    geometry.addGroup(
      groupStart*3,
      fragment.polygonTextures[i].polygonCount*3,
      i
    )
    groupStart += fragment.polygonTextures[i].polygonCount
    if (fragment.polygonTextures[i].texturePaths) {
      textures.push({
        texture: fragment.polygonTextures[i].texture,
        textureInfo: fragment.polygonTextures[i].textureInfo,
        texturePaths: fragment.polygonTextures[i].texturePaths
      })
    }
  }
  geometry.computeBoundingBox()
  //geometry.computeBoundingSphere()
  let materials = []
  for (let texture of textures) {
    if (!(texture.texture.name in materialCache)) {
      let path = texture.texture.masked ?
        `textures/${texture.texturePaths[0].files[0].substr(0, texture.texturePaths[0].files[0].indexOf('.')).toLowerCase()}_alpha.png` :
        `textures/${texture.texturePaths[0].files[0].substr(0, texture.texturePaths[0].files[0].indexOf('.')).toLowerCase()}.png`
      if (!(path in imageCache)) {
        let img = new Image()
        img.src = path
        imageCache[path] = img
      }
      let tex = new THREE.Texture(imageCache[path])
      tex.wrapS = THREE.RepeatWrapping
      tex.wrapT = THREE.RepeatWrapping
      tex.magFilter = THREE.LinearFilter
      tex.minFilter = THREE.LinearFilter
      let material = new THREE.MeshBasicMaterial({
        ...(tex ? {map: tex} : {}),
        //...((texture.texture.masked && alpha) ? {alphaMap: alpha} : {}),
        ...((!texture.texture.apparentlyNotTransparent || texture.texture.masked) ? {transparent: 1} : {}),
        ...(!texture.texture.apparentlyNotTransparent ? {opacity: 0} : {}),
        ...((texture.texture.masked) ? {alphaTest: 0.8} : {}),
      })
      if (texture.textureInfo.animatedFlag) {
        let frames = []
        for (let framePath of texture.texturePaths) {
          let p = texture.texture.masked ?
          `${framePath.files[0].substr(0, framePath.files[0].indexOf('.')).toLowerCase()}_alpha.png` :
            `${framePath.files[0].substr(0, framePath.files[0].indexOf('.')).toLowerCase()}.png`
          frames.push(p)
        }
        let frameTime = texture.textureInfo.frameTime
        material.userData.textureAnimation = {
          name: texture.texture.name,
          frames,
          frameTime
        }
      }
      materialCache[texture.texture.name] = material
    }
    materials.push(materialCache[texture.texture.name])
  }
  let mesh = new THREE.Mesh(geometry, materials)
  mesh.name = fragment.name
  return mesh
}

function walkSkeleton(chr, entries, bone, parentShift = new THREE.Vector3(), parentRot = new THREE.Euler(0, 0, 0, 'YXZ')) {
  let pieceRef = chr[bone.Fragment1]
  let piece = chr[pieceRef.skeletonPieceTrack]
  piece.shift = new THREE.Vector3(piece.shiftX[0], piece.shiftY[0], piece.shiftZ[0]).divideScalar(piece.shiftDenominator[0])
  piece.shift.applyEuler(parentRot)
  piece.shift.add(parentShift)
  let rotVector = new THREE.Vector3(piece.rotateX[0], piece.rotateY[0], piece.rotateZ[0]).divideScalar(piece.rotateDenominator).multiplyScalar(Math.PI / 2)
  rotVector.add(parentRot.toVector3())
  piece.rot = new THREE.Euler().setFromVector3(rotVector, 'YXZ')
  for (let b of bone.Data) {
    walkSkeleton(
      chr,
      entries,
      entries[b],
      piece.shift,
      piece.rot
    )
  }
}

module.exports = {
  convertDir,
  convertS3D
}