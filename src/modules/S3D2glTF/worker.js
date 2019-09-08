const {  parentPort } = require('worker_threads')
const THREE = require('three')
const GLTFExporter = require('../GLTFExporter')
const loadWLD = require('./loaders/wld')
const loadMesh = require('./loaders/mesh')

function convertS3D(s3dName, type, s3d, out) {
  if (type === "chr") {
    if (s3dName.indexOf('gequip') !== -1) {
      out = 'graphics/items'
    } else {
      out = 'graphics/characters'
    }
  }
  switch(type) {
    case 'zone':
      convertZoneToglTF(s3dName, s3d, out)
      break
    case 'chr':
      convertChrToglTFs(s3dName, s3d, out)
      break
    case 'obj':
      convertObjToglTFs(s3dName, s3d, out)
      break
    default:
      throw new Error('Unknown S3D type')
  }
}

function convertZoneToglTF(zoneName, s3d, out) {
  //console.log(`Converting ${zoneName}`)
  parentPort.postMessage({type: "log", message: `Converting ${zoneName}`})
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
      let mesh = loadMesh(fragment, zone, materialCache, imageCache)
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
    parentPort.postMessage({type: "file", out: `${out}/${zoneName}.glb`, data: Buffer.from(gltf)})
    parentPort.postMessage({type: "done"})
  }, {
    embedImages: false,
    binary: true
  })
}

function convertObjToglTFs(zoneName, s3d, out) {
  //console.log(`Converting ${zoneName}_obj`)
  parentPort.postMessage({type: "log", message: `Converting ${zoneName}_obj`})
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
        let mesh = loadMesh(meshInfo, zone, materialCache, imageCache)
        mesh.name = fragment.name
        scene.add(mesh)
      }
    }
  }
  const exporter = new GLTFExporter()
  exporter.parse(scene, gltf => {
    /*fs.writeFile(`${out}/${zoneName}_obj.glb`, Buffer.from(gltf), err => {
      if (err) throw new Error(err)
    })*/
    parentPort.postMessage({type: "file", out: `${out}/${zoneName}_obj.glb`, data: Buffer.from(gltf)})
    parentPort.postMessage({type: "done"})
  }, {
    embedImages: false,
    binary: true
  })
}

function convertChrToglTFs(zoneName, s3d, out) {
  //console.log(`Converting ${zoneName}_chr`)
  parentPort.postMessage({type: "log", message: `Converting ${zoneName}_chr`})
  let wld = zoneName.indexOf('gequip') !== -1 ? s3d.files[`${zoneName}.wld`] : s3d.files[`${zoneName}_chr.wld`]
  let zone = loadWLD(wld)
  let zoneKeys = Object.keys(zone)
  let materialCache = {}
  let imageCache = {}
  let meshes = []
  for (let fragIndex in zone) {
    let fragment = zone[fragIndex]
    let mesh0
    if (fragment.type === "StaticModelRef") {
      let raceCode = fragment.name.substr(0, fragment.name.indexOf('_'))
      mesh0 = zone[fragment.meshReferences[0]]
      let entries = []
      if (mesh0.type === "SkeletonTrackRef") {
        
      }
      let scene = new THREE.Scene()
      if (mesh0.type === "SkeletonTrackRef") {
        let skeletonFragment = zone[fragment.meshReferences[0]] && zone[fragment.meshReferences[0]].skeletonTrack && zone[zone[fragment.meshReferences[0]].skeletonTrack]
        entries = skeletonFragment && skeletonFragment.entries
        if (entries.length > 0) {
          let stem = entries[0]
          walkSkeleton(zone, entries, stem)
        }
        let group = new THREE.Group()
        group.name = raceCode
        let rootName =  zone[mesh0.skeletonTrack].name.substr(0, zone[mesh0.skeletonTrack].name.indexOf('_'))
        for (let fragIndex2 in zone) {
          let f = zone[fragIndex2]
          if (f && f.type === "Mesh" && meshes.indexOf(f) === -1) meshes.push(f) // debug
          if (f && f.type === "Mesh" && (f.name.indexOf(raceCode) !== -1 || f.name.indexOf(rootName) !== -1)) {
            let helmchr = f.name.substr(3, f.name.indexOf('_') - 3)
            let helm = helmchr.length == 0 ? "BASE" : helmchr.indexOf("HE") !== -1 ? helmchr : `BO${helmchr}`
            let mesh =  loadMesh(f, zone, materialCache, imageCache, entries)
            mesh.userData.helm = helm
            group.add(mesh)
          }
        }
        scene.add(group)
      } else if (mesh0.type === "MeshRef") {
        let mesh = loadMesh(zone[mesh0.mesh], zone, materialCache, imageCache)
        scene.add(mesh)
      }
      const exporter = new GLTFExporter()
      exporter.parse(scene, gltf => {
        if (!(gltf instanceof ArrayBuffer)) {
          parentPort.postMessage({type: "skip", name: raceCode})
        } else {
          let data
          try {
            data = Buffer.from(gltf)
          } catch(err) {
            throw new Error(err)
          }
          parentPort.postMessage({type: "file", out: `${out}/${raceCode}.glb`, data })
        }
        if (fragIndex === zoneKeys[zoneKeys.length-1]) parentPort.postMessage({type: "done"})
      }, {
        embedImages: false,
        binary: true
      })
    }
  }
  parentPort.postMessage({type: "done"})
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

process.on('uncaughtException', err => {
  console.error(err.stack)
  parentPort.postMessage({type: 'error', err})
})
parentPort.on('message', message => {
  if (message.type == "job") {
    convertS3D(message.s3dName, message.s3dType, message.s3d, message.out)
  }
})

//convertS3D(workerData.s3dName, workerData.type, workerData.s3d, workerData.out)
