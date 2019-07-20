import * as THREE from 'three'
import { store } from '../store'
import { changeScene } from '../store/actions'
import FlyCamera from './flyCamera'
import Selector from './selector'
import InfoBox from './infoBox';
import EventEmitter from 'events';

export default class Scene extends EventEmitter {
  constructor(zoneShortName) {
    super()
    this.zoneShortName = zoneShortName
    this.infoBox = null
    this.scene = null
    this.camera = null
    this.selector = null
    this.ambientLight = null
    this.clock = null
    this.raycaster = null
    this.zoneInfo = {}
    this.renderer = null
    this.loadingContainer = null
    this.material_cache = {}
    this.chr = {}
    this.chr_s3d = {}
    this.chr_meshCache = {}
    this.Init()
  }

  Init() {
    store.dispatch(changeScene(this))
    this.loadingContainer = document.getElementById('loading-container')
    this.infoBox = new InfoBox()
    this.scene =  new THREE.Scene()
    this.camera = new FlyCamera()
    this.scene.add(this.camera.object)
    this.camera.updateCameraRotation()

    this.selector = new Selector()

    this.ambientLight = new THREE.AmbientLight( 0xffffff, 1 )
    this.scene.add( this.ambientLight )
    this.scene.background = new THREE.Color().setHex(0x82eaff)
    this.scene.fog = new THREE.Fog(new THREE.Color().setHex(0x82eaff), 600, 1000)

    this.clock = new THREE.Clock()

    this.raycaster = new THREE.Raycaster()

    this.updateZoneInfo(true)
    this.updateZoneS3D()

    this.renderer = new THREE.WebGLRenderer()
    this.renderer.setSize( window.innerWidth, window.innerHeight )
    document.getElementById('viewport').appendChild( this.renderer.domElement )
    window.addEventListener('resize', this.onViewportResize.bind(this))
    this.animate()
  }

  updateZoneInfo(goToHome = false) {
    fetch(`/zone/shortname/${this.zoneShortName}`).then(res => {
      return res.json()
    }).then(res => {
      console.log(`Zone Info fetched: ${res.zoneInfo[0].long_name}`)
      this.zoneInfo = res.zoneInfo[0]
      this.spawn2 = res.spawn2
      this.spawngroup = res.spawngroup
      this.spawnentry = res.spawnentry
      this.npcTypes = res.npcTypes
      //this.scene.fog = new THREE.Fog(new Three.COLOR(zoneInfo.fog_red, zoneInfo.fog_green, zoneInfo.fog_blue).getHEX(), zoneInfo.fog_minclip, zoneInfo.fog_maxclip)
      if (goToHome) {
        this.camera.object.position.set(this.zoneInfo.safe_y, this.zoneInfo.safe_x, this.zoneInfo.safe_z+2)
      }
      this.updateChr(this.loadSpawns.bind(this))
    })
  }

  updateZoneS3D() {
    fetch(`/zone/s3d/${this.zoneShortName}`).then(res => {
      return res.json()
    }).then(res => {
      console.log("Fetched zone Geometry")
      fetch(`/zone/s3d_obj/${this.zoneShortName}`).then(resobj => {
        return resobj.json()
      }).then(resobj => {
        console.log("Fetched zone object Geometry")
        this.loadWLD(res.wld, res.s3d, res.obj, resobj.wld, resobj.s3d, this.onFinishLoading.bind(this))
      })
    })
  }

  updateChr(cb) {
    fetch(`/zone/s3d_chr/${this.zoneShortName}`).then(res => {
      return res.json()
    }).then(res => {
      console.log("Fetched chr")
      this.loadChr(res.wld, res.s3d)
      cb()
    })
  }

  onFinishLoading() {
    console.log("Finished Loading")
    this.loadingContainer.style.visibility = "hidden"
  }

  loadWLD(wld, s3d, obj, wldobj, objs3d, cb) {
    for (let fragIndex in wld) {
      let fragment = wld[fragIndex]
      if (fragment.type === "Mesh") {
        for (mesh of this.loadWLDMesh(fragment, fragIndex, wld, s3d)) {
          this.scene.add(mesh)
        }
      }
    }
    for (let fragIndex in obj) {
      let fragment = obj[fragIndex]
      if (fragment.type === "ObjectLocation") {
        for (let i in wldobj) {
          if (wldobj[i].name === fragment.ref) {
            let meshRef = wldobj[i].meshReferences[0]
            let mesh = wldobj[wldobj[meshRef].mesh]
            for (mesh of this.loadWLDMesh(mesh, meshRef, wldobj, objs3d, fragment.x, fragment.y, fragment.z, fragment.rotX, fragment.rotY, fragment.rotZ, fragment.scaleX, fragment.scaleY)) {
              this.scene.add(mesh)
            }
            break
          }
        }
      }
    }
    cb()
  }

  loadChr(chr, s3d) {
    this.chr = chr
    this.chr_s3d = s3d
    //console.log(chr)
  }

  loadWLDMesh(fragment, fragIndex, wld, s3d, x = 0, y = 0, z = 0, rotX = 0, rotY = 0, rotZ = 0, scaleX = 1, scaleY = 1, skeletonEntries = []) {
    console.log(fragment)
    console.log(skeletonEntries)
    let meshes = []
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
      let normal1 = fragment.vertexNormals[p.vertex3]
      let normal2 = fragment.vertexNormals[p.vertex2]
      let normal3 = fragment.vertexNormals[p.vertex1]
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
      uvs.push(
        uv1.x / uvDivisor, uv1.z / uvDivisor,
        uv2.x / uvDivisor, uv2.z / uvDivisor,
        uv3.x / uvDivisor, uv3.z / uvDivisor,
      )
      polygonTexCount++
      if (polygonTexCount >= fragment.polygonTextures[polygonTexIndex].polygonCount) {
        geometry.addAttribute('position', new THREE.BufferAttribute(new Float32Array(vertices), 3))
        geometry.addAttribute('normal', new THREE.BufferAttribute(new Float32Array(normals), 3))
        geometry.addAttribute('uv', new THREE.BufferAttribute(new Float32Array(uvs), 2))
        geometry.computeBoundingBox()
        let material = null
        let textureFile = fragment.polygonTextures[polygonTexIndex].texturePaths ? fragment.polygonTextures[polygonTexIndex].texturePaths[0].files[0].toLowerCase() : null
        if (textureFile) {
          if (!this.material_cache[textureFile]) {
            let textureFire = fragment.polygonTextures[polygonTexIndex].texturePaths[0].files[0].toLowerCase().indexOf("fire") !== -1
            let textureRaw = s3d.files[fragment.polygonTextures[polygonTexIndex].texturePaths[0].files[0].toLowerCase()]
            let textureBuffer = textureRaw ? new Buffer(textureRaw) : null
            let alphaBuffer = textureRaw ? new Buffer(textureRaw) : null
            if (alphaBuffer) {
              let textureType = String.fromCharCode(alphaBuffer.readInt8(0)) + String.fromCharCode(alphaBuffer.readInt8(1))
              if (textureType === 'BM' && fragment.polygonTextures[polygonTexIndex].texture.masked) {
                let bSize = alphaBuffer.readUInt16LE(2)
                let bOffset = alphaBuffer.readUInt16LE(10)
                let bHSize = alphaBuffer.readUInt16LE(14)
                let bDepth = alphaBuffer.readInt8(28)
                let bColorTableCount = alphaBuffer.readUInt16LE(46) || Math.pow(2, bDepth)
                let bColorTableOffset = 14 + bHSize
                let bTransparentIndex = 0//alphaBuffer.readUInt8(bOffset)
                for (let i = 0; i < bColorTableCount; i++) {
                  let bNewColor = i === bTransparentIndex ? 0x00 : 0xFF
                  alphaBuffer.writeUInt8(bNewColor, bColorTableOffset + i * 4)
                  alphaBuffer.writeUInt8(bNewColor, bColorTableOffset + 1 + i * 4)
                  alphaBuffer.writeUInt8(bNewColor, bColorTableOffset + 2 + i * 4)
                  alphaBuffer.writeUInt8(bNewColor, bColorTableOffset + 3 + i * 4)
                }
              }
            }
            let textureData = textureBuffer ? textureBuffer.toString('base64') : null
            let textureURI = `data:image/bmp;base64,${textureData}`
            let alphaData = alphaBuffer ? new Buffer(alphaBuffer).toString('base64') : null
            let alphaURI = `data:image/bmp;base64,${alphaData}`
            let texture = new THREE.Texture()
            texture.wrapS = THREE.RepeatWrapping
            texture.wrapT = THREE.RepeatWrapping
            //texture.magFilter = THREE.NearestFilter // EQ Filters textures
            //texture.minFilter = THREE.NearestFilter
            let alpha = new THREE.Texture()
            alpha.wrapS = THREE.RepeatWrapping
            alpha.wrapT = THREE.RepeatWrapping
            //alpha.magFilter = THREE.NearestFilter
            //alpha.minFilter = THREE.NearestFilter
            let image = new Image()
            image.onload = () => {
              texture.image = image
              texture.needsUpdate = true
            }
            image.src = textureURI
            let alphaImage = new Image()
            alphaImage.onload = () => {
              alpha.image = alphaImage
              alpha.needsUpdate = true
            }
            if (textureFire) {
              alphaImage.src = textureURI
              alpha.format = THREE.LuminanceFormat
            } else {
              alphaImage.src = alphaURI
            }
            this.material_cache[textureFile] =  new THREE.MeshLambertMaterial({
              map: texture,
              ...(fragment.polygonTextures[polygonTexIndex].texture.masked ? {alphaMap: alpha} : {}),
              ...((!fragment.polygonTextures[polygonTexIndex].texture.apparentlyNotTransparent || fragment.polygonTextures[polygonTexIndex].texture.masked) ? {transparent: 1} : {}),
              ...(!fragment.polygonTextures[polygonTexIndex].texture.apparentlyNotTransparent ? {opacity: 0} : {}),
              alphaTest: 0.8
            })
            /*
            console.log(`${textureFile}:
              notTransparent(${fragment.polygonTextures[polygonTexIndex].texture.notTransparent})
              masked(${fragment.polygonTextures[polygonTexIndex].texture.masked})
              semitransparentNoMask(${fragment.polygonTextures[polygonTexIndex].texture.semitransparentNoMask})
              semitransparentMask(${fragment.polygonTextures[polygonTexIndex].texture.semitransparentMask})
              notSemitransparentMask(${fragment.polygonTextures[polygonTexIndex].texture.notSemitransparentMask})
              apparentlyNotTransparent(${fragment.polygonTextures[polygonTexIndex].texture.apparentlyNotTransparent})
            `)
            */
          }
          material = this.material_cache[textureFile]
        }
        var mesh = new THREE.Mesh(geometry, material)
        mesh.position.set(x, y, z)
        mesh.scale.set(scaleX, scaleX, scaleY)
        mesh.rotateOnAxis(new THREE.Vector3(0, 0, 1), THREE.Math.degToRad(rotZ / (512/360)))
        mesh.rotateOnAxis(new THREE.Vector3(1, 0, 0), THREE.Math.degToRad(rotY / (512/360)))
        mesh.rotateOnAxis(new THREE.Vector3(0, 1, 0), THREE.Math.degToRad(rotX / (512/360)))
        mesh.userData.fragIndex = fragIndex
        mesh.userData.fragment = fragment
        meshes.push(mesh)
        geometry = new THREE.BufferGeometry()
        vertices = []
        normals = []
        uvs = []
        polygonTexIndex++
        polygonTexCount = 0
      }
    }
    return meshes
  }

  animate() {
    requestAnimationFrame(() => this.animate())
    this.render()
  }

  render() {
    let delta = this.clock.getDelta()
    this.renderer.render(this.scene, this.camera.object)
    this.emit('render', [delta])
  }

  loadSpawns() {
    for (let spawn of this.spawn2) {
      let npcTypes = []
      for (let se of this.spawnentry) {
        if (se.spawngroupID === spawn.spawngroupID) {
          for (let n of this.npcTypes) {
            if (se.npcID === n.id) {
              npcTypes.push(n)
              break
            }
          }
        }
      }
      let geo = new THREE.SphereGeometry(2, 16, 16)
      let mat = new THREE.MeshLambertMaterial({color: new THREE.Color(1, 1, 0).getHex(), transparent: true, opacity: 0.2, alphaTest: 0.5})
      let base = new THREE.Mesh(geo, mat)
      base.position.set(spawn.y, spawn.x, spawn.z)
      base.userData.selectable = true
      base.userData.type = "SpawnPoint"
      base.userData.spawnInfo = spawn
      base.userData.npcTypes = npcTypes
      let race = 54
      let raceCode = "ORC"
      if (!this.chr_meshCache[raceCode]) {
        let modelKey = `${raceCode}_ACTORDEF`
        let modelFragment = null
        for (let modelRefIndex = 0; modelRefIndex < Object.keys(this.chr).length; modelRefIndex++) {
          modelFragment = this.chr[modelRefIndex]
          if (modelFragment.name === modelKey) {
            break
          }
        }
        let skeletonFragment = this.chr[this.chr[modelFragment.meshReferences[0]].skeletonTrack]
        let entries = skeletonFragment.entries
        let stem = entries[0]
        this.walkSkeleton(entries, stem)
        let cache = []
        for (let i = 0; i < Object.keys(this.chr).length; i++) {
          let f = this.chr[i]
          if (f.type === "Mesh" && f.name.indexOf(raceCode) !== -1) {
            cache = cache.concat(this.loadWLDMesh(f, i, this.chr, this.chr_s3d, 0, 0, 0, 0, 0, 0, 1, 1, entries))
          }
        }
        console.log(`cache: ${cache}`)
        this.chr_meshCache[raceCode] = cache
      }
      for (let mesh of this.chr_meshCache[raceCode]) {
        base.add(mesh.clone())
      }
      this.scene.add(base)
    }
  }

  walkSkeleton(entries, bone, parentShift = new THREE.Vector3(), parentRot = new THREE.Euler(0, 0, 0, 'YXZ')) {
    let pieceRef = this.chr[bone.Fragment1]
    let piece = this.chr[pieceRef.skeletonPieceTrack]
    piece.shift = new THREE.Vector3(piece.shiftX[0], piece.shiftY[0], piece.shiftZ[0]).divideScalar(piece.shiftDenominator[0])
    piece.shift.applyEuler(parentRot)
    piece.shift.add(parentShift)
    let rotVector = new THREE.Vector3(piece.rotateX[0], piece.rotateY[0], piece.rotateZ[0]).divideScalar(piece.rotateDenominator).multiplyScalar(Math.PI / 2)
    rotVector.add(parentRot.toVector3())
    piece.rot = new THREE.Euler().setFromVector3(rotVector, 'YXZ')
    for (b of bone.Data) {
      this.walkSkeleton(entries,
        entries[b],
        piece.shift,
        piece.rot
      )
    }
  }

  onViewportResize() {
    this.renderer.setSize( window.innerWidth, window.innerHeight )
  }
}
