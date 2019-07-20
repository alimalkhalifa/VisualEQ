import * as THREE from 'three'
import { store } from '../store'
import { changeScene } from '../store/actions'
import FlyCamera from './flyCamera'
import Selector from './selector'
import InfoBox from './infoBox';
import EventEmitter from 'events';
import raceCodes from '../../common/constants/raceCodeConstants.json'
import { Quaternion } from 'three';

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
    this.chr_meshCache = {}
    this.chrtextures = {}
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
    })
  }

  updateZoneS3D() {
    fetch(`/zone/s3d/${this.zoneShortName}`).then(res => {
      return res.json()
    }).then(res => {
      console.log(res)
      let objectLoader = new THREE.ObjectLoader()
      let world = objectLoader.parse(res.scene)
      for (let w of world.children) {
        w.material = this.loadMaterial(w.userData.textureFile, res.textures, w.userData.texture.texture)
      }
      for (let o of res.objectLocations) {
        for (let m of res.meshCache[o.name]) {
          let mesh = objectLoader.parse(m)
          mesh.position.copy(new THREE.Vector3().fromArray(o.position))
          mesh.quaternion.copy(new THREE.Quaternion().setFromEuler(new THREE.Euler().setFromVector3(new THREE.Vector3().fromArray(o.rot))))
          mesh.scale.copy(new THREE.Vector3().fromArray(o.scale))
          mesh.material = this.loadMaterial(mesh.userData.textureFile, res.objtextures, mesh.userData.texture.texture)
          world.add(mesh)
        }
      }
      this.scene.add(world)
      for (let c in res.characters) {
        let cache = []
        for (let m of res.characters[c]) {
          let mesh = objectLoader.parse(m)
          mesh.material = this.loadMaterial(mesh.userData.textureFile, res.chrtextures, mesh.userData.texture.texture)
          cache.push(mesh)
        }
        this.chr_meshCache[c] = cache
      }
      this.chrtextures = res.chrtextures
      this.loadSpawns()
    })
  }

  loadMaterial(textureName, textures, textureInfo, textureNumber = 0) {
    if (textureNumber > 0) {
      textureName = textureName.substr(0, textureName.indexOf('0')) + "0" + textureNumber + textureName.substr(textureName.indexOf('0') + 2)
    }
    if (this.material_cache[textureName]) return this.material_cache[textureName]
    let data = null
    for (let t in textures) {
      if (t.toLowerCase() === textureName) {
        data = textures[t]
      }
    }
    return this.loadTextureMaterial(textureName, data, textureInfo)
  }

  loadTextureMaterial(textureName, data, textureInfo) {
    let textureFire = textureName.indexOf("fire") !== -1
    let textureRaw = data
    let textureBuffer = new Buffer(textureRaw)
    let alphaBuffer = new Buffer(textureRaw)
    if (alphaBuffer) {
      let textureType = String.fromCharCode(alphaBuffer.readInt8(0)) + String.fromCharCode(alphaBuffer.readInt8(1))
      if (textureType === 'BM' && textureInfo.masked) {
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
    let alphaData = alphaBuffer ? alphaBuffer.toString('base64') : null
    let alphaURI = `data:image/bmp;base64,${alphaData}`
    let texture = new THREE.Texture()
    texture.wrapS = THREE.RepeatWrapping
    texture.wrapT = THREE.RepeatWrapping
    let textureImageElem = new Image()
    textureImageElem.onload = () => {
      texture.image = textureImageElem
      texture.needsUpdate = true
    }
    textureImageElem.src = textureURI
    let alpha = new THREE.Texture()
    let alphaImageElem = new Image()
    alphaImageElem.onload = () => {
      alpha.image = alphaImageElem
      alpha.needsUpdate = true
    }
    if (textureFire) {
      alphaImageElem.src = textureURI
      alpha.format = THREE.LuminanceFormat
    } else {
      alphaImageElem.src = alphaURI
    }
    alpha.wrapS = THREE.RepeatWrapping
    alpha.wrapT = THREE.RepeatWrapping
    this.material_cache[textureName] =  new THREE.MeshLambertMaterial({
      map: texture,
      ...(textureInfo.masked ? {alphaMap: alpha} : {}),
      ...((!textureInfo.apparentlyNotTransparent || textureInfo.masked) ? {transparent: 1} : {}),
      ...(!textureInfo.apparentlyNotTransparent ? {opacity: 0} : {}),
      alphaTest: 0.8
    })
    return this.material_cache[textureName]
  }

  onFinishLoading() {
    console.log("Finished Loading")
    this.loadingContainer.style.visibility = "hidden"
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
      let spawngroup
      for (let sg of this.spawngroup) {
        if (sg.id === spawn.spawngroupID) {
          spawngroup = sg
          break
        }
      }
      let spawnentry = []
      let npcTypes = []
      for (let se of this.spawnentry) {
        if (se.spawngroupID === spawn.spawngroupID) {
          spawnentry.push(se)
          for (let n of this.npcTypes) {
            if (se.npcID === n.id) {
              npcTypes.push(n)
              break
            }
          }
        }
      }
      let geo = new THREE.SphereGeometry(2, 16, 16)
      let mat = new THREE.MeshLambertMaterial({color: new THREE.Color(1, 1, 0).getHex(), transparent: true, opacity: 0.2, alphaTest: 0.2})
      let base = new THREE.Mesh(geo, mat)
      base.position.set(spawn.y, spawn.x, spawn.z)
      base.userData.selectable = true
      base.userData.type = "SpawnPoint"
      base.userData.spawnInfo = spawn
      base.userData.spawngroup = spawngroup
      base.userData.spawnentry = spawnentry
      base.userData.npcTypes = npcTypes
      let npc = npcTypes[0]
      let genderName = npc.gender === 0 ? 'male' : npc.gender === 1 ? 'female' : 'neutral'
      let raceCode = raceCodes[npc.race][genderName]
      if (this.chr_meshCache[raceCode]) {
        for (let mesh of this.chr_meshCache[raceCode]) {
          let newmesh = mesh.clone().rotateOnAxis(new THREE.Vector3(0,0,1), THREE.Math.degToRad(spawn.heading - 90))
          if (npc.texture > 0) newmesh.material = this.loadMaterial(newmesh.userData.textureFile, this.chrtextures, newmesh.userData.texture.texture, npc.texture)
          base.add(newmesh) 
        }
      }
      this.scene.add(base)
    }
    this.onFinishLoading()
  }

  onViewportResize() {
    this.renderer.setSize( window.innerWidth, window.innerHeight )
  }
}
