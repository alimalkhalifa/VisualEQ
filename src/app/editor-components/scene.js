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
    this.getSpawns()

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
      console.log(`Zone Info fetched: ${res[0].long_name}`)
      this.zoneInfo = res[0]
      //this.scene.fog = new THREE.Fog(new Three.COLOR(zoneInfo.fog_red, zoneInfo.fog_green, zoneInfo.fog_blue).getHEX(), zoneInfo.fog_minclip, zoneInfo.fog_maxclip)
      if (goToHome) {
        this.camera.object.position.set(this.zoneInfo.safe_y, this.zoneInfo.safe_x, this.zoneInfo.safe_z+2)
      }
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

  onFinishLoading() {
    console.log("Finished Loading")
    this.loadingContainer.style.visibility = "hidden"
  }

  loadWLD(wld, s3d, obj, wldobj, objs3d, cb) {
    for (let fragIndex in wld) {
      let fragment = wld[fragIndex]
      if (fragment.type === "Mesh") {
        this.loadWLDMesh(fragment, fragIndex, wld, s3d)
      }
    }
    for (let fragIndex in obj) {
      let fragment = obj[fragIndex]
      if (fragment.type === "ObjectLocation") {
        for (let i in wldobj) {
          if (wldobj[i].name === fragment.ref) {
            let meshRef = wldobj[i].meshReferences[0]
            let mesh = wldobj[wldobj[meshRef].mesh]
            this.loadWLDMesh(mesh, meshRef, wldobj, objs3d, fragment.x, fragment.y, fragment.z, fragment.rotX, fragment.rotY, fragment.rotZ, fragment.scaleX, fragment.scaleY)
            break
          }
        }
      }
    }
    cb()
  }

  loadWLDMesh(fragment, fragIndex, wld, s3d, x = 0, y = 0, z = 0, rotX = 0, rotY = 0, rotZ = 0, scaleX = 1, scaleY = 1) {
    fragment.textureListRef = wld[fragment.textureList]
    for (let t in fragment.polygonTextures) {
      fragment.polygonTextures[t].texture = wld[fragment.textureListRef.textureInfoRefsList[fragment.polygonTextures[t].textureIndex]]
      let textureInfoRef = wld[fragment.polygonTextures[t].texture.textureInfoRef]
      fragment.polygonTextures[t].textureInfo = wld[textureInfoRef.textureInfo]
      let texturePathsRef = fragment.polygonTextures[t].textureInfo.texturePaths
      fragment.polygonTextures[t].texturePaths = []
      for (let p of texturePathsRef) {
        fragment.polygonTextures[t].texturePaths.push(wld[p])
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
        let textureFire = fragment.polygonTextures[polygonTexIndex].texturePaths[0].files[0].toLowerCase().indexOf("fire") !== -1
        let textureRaw = s3d.files[fragment.polygonTextures[polygonTexIndex].texturePaths[0].files[0].toLowerCase()]
        let textureBuffer = new Buffer(textureRaw)
        let alphaBuffer = new Buffer(textureRaw)
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
        let textureData = new Buffer(textureBuffer).toString('base64')
        let textureURI = `data:image/bmp;base64,${textureData}`
        let alphaData = new Buffer(alphaBuffer).toString('base64')
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
        let material = new THREE.MeshLambertMaterial({
          map: texture,
          ...(fragment.polygonTextures[polygonTexIndex].texture.masked ? {alphaMap: alpha} : {}),
          ...((fragment.polygonTextures[polygonTexIndex].texture.transparent || fragment.polygonTextures[polygonTexIndex].texture.masked) ? {transparent: 1} : {}),
          ...(fragment.polygonTextures[polygonTexIndex].texture.transparent ? {opacity: 0} : {}),
          alphaTest: 0.8
        })
        var mesh = new THREE.Mesh(geometry, material)
        mesh.position.set(x, y, z)
        mesh.scale.set(scaleX, scaleX, scaleY)
        mesh.rotateOnAxis(new THREE.Vector3(0, 0, 1), THREE.Math.degToRad(rotZ / (512/360)))
        mesh.rotateOnAxis(new THREE.Vector3(1, 0, 0), THREE.Math.degToRad(rotY / (512/360)))
        mesh.rotateOnAxis(new THREE.Vector3(0, 1, 0), THREE.Math.degToRad(rotX / (512/360)))
        mesh.userData.fragIndex = fragIndex
        mesh.userData.fragment = fragment
        this.scene.add(mesh)
        geometry = new THREE.BufferGeometry()
        vertices = []
        normals = []
        uvs = []
        polygonTexIndex++
        polygonTexCount = 0
      }
    }
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

  getSpawns() {
    fetch(`/zone/spawns/${this.zoneShortName}`).then(res => {
      return res.json()
    }).then(res => {
      let geometry = new THREE.SphereGeometry(1, 16, 16)
      let material = new THREE.MeshBasicMaterial({color: 0xffff00})
      for (let spawn of res) {
        let sphere = new THREE.Mesh(geometry, material)
        sphere.position.set(spawn.y, spawn.x, spawn.z)
        sphere.userData.selectable = true
        sphere.userData.type = "SpawnPoint"
        sphere.userData.spawnInfo = spawn
        this.scene.add(sphere)
      }
    })
  }

  onViewportResize() {
    this.renderer.setSize( window.innerWidth, window.innerHeight )
  }
}
