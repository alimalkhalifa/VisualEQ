import * as THREE from 'three'
import GLTFLoader from 'three-gltf-loader'
import jimp from 'jimp'
import { store } from '../store'
import { changeScene } from '../store/actions'
import FlyCamera from './flyCamera'
import Selector from './selector'
import InfoBox from './infoBox';
import EventEmitter from 'events';
import pako from 'pako'
import raceCodes from '../../common/constants/raceCodeConstants.json'
import { Quaternion, MeshBasicMaterial } from 'three';
import Helper from '../helper';
import { ETIME } from 'constants';

export default class Scene extends EventEmitter {
  constructor() {
    super()
    this.infoBox = null
    this.scene = null
    this.camera = null
    this.selector = null
    this.ambientLight = null
    this.clock = null
    this.raycaster = null
    this.zoneInfo = {}
    this.renderer = null
    this.viewport = null
    this.loadingContainer = null
    this.material_cache = {}
    this.chr_meshCache = {}
    this.chrtextures = {}
    this.onViewportResize = this.onViewportResize.bind(this)
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
    this.scene.fog = new THREE.Fog(new THREE.Color().setHex(0x82eaff), 4000, 5000)

    this.clock = new THREE.Clock()

    this.raycaster = new THREE.Raycaster()

    this.updateZoneInfo(true)
    this.updateZoneS3D()

    this.renderer = new THREE.WebGLRenderer()
    this.viewport = document.getElementById('viewport')
    this.renderer.setSize( this.viewport.clientWidth, this.viewport.clientHeight )
    this.viewport.appendChild( this.renderer.domElement )
    window.addEventListener('resize', this.onViewportResize)
    this.animate()
  }

  dispose() {
    window.removeEventListener('resize', this.onViewportResize)
    this.infoBox.disconnect()
    this.camera.disconnect()
    this.selector.disconnect()
    this.scene.dispose()
    this.viewport.removeChild( this.renderer.domElement )
    this.renderer.dispose()
  }

  updateZoneInfo(goToHome = false) {
    fetch(`/zone/shortname/${store.getState().zone}`).then(res => {
      return res.json()
    }).then(res => {
      console.log(`Zone Info fetched: ${res.zoneInfo[0].long_name}`)
      this.zoneInfo = res.zoneInfo[0]
      this.spawn2 = res.spawn2
      this.spawngroup = res.spawngroup
      this.spawnentry = res.spawnentry
      this.npcTypes = res.npcTypes
      this.npcTypesTint = res.npcTypesTint
      //this.scene.fog = new THREE.Fog(new Three.COLOR(zoneInfo.fog_red, zoneInfo.fog_green, zoneInfo.fog_blue).getHEX(), zoneInfo.fog_minclip, zoneInfo.fog_maxclip)
      if (goToHome) {
        this.camera.object.position.set(this.zoneInfo.safe_y, this.zoneInfo.safe_x, this.zoneInfo.safe_z+2)
      }
    })
  }

  updateZoneS3D() {
    let loader = new GLTFLoader()
    loader.load(`graphics/${store.getState().zone}/${store.getState().zone}.gltf`, gltf => {
      this.scene.add(gltf.scene)
      this.loadSceneMaterials(gltf.scene)
      loader.load(`graphics/${store.getState().zone}/${store.getState().zone}_obj.gltf`, objgltf => {
        this.loadSceneMaterials(objgltf.scene)
        let objectLocations = gltf.scene.userData.objectLocations
        for (let obj of objectLocations) {
          let mesh = objgltf.scene.children.find(value => value.name === obj.name)
          if (mesh) {
            let newmesh = mesh.clone()
            newmesh.position.copy(new THREE.Vector3().fromArray(obj.position))
            newmesh.quaternion.copy(new THREE.Quaternion().setFromEuler(new THREE.Euler().setFromVector3(new THREE.Vector3().fromArray(obj.rot))))
            newmesh.scale.copy(new THREE.Vector3().fromArray(obj.scale))
            this.scene.add(newmesh)
          }
        }
      })
      this.onFinishLoading() // DEBUG
    }, xhr => {
      document.getElementById('loading-percentage').innerHTML = `${Math.round(xhr.loaded / xhr.total * 100)}% loaded`
    }, err => {
      console.error(err)
    })
    /*fetch(`/zone/s3d/${this.zoneShortName}`).then(res => {
      return res.text()
    }).then(res => {
      res = JSON.parse(pako.inflate(res, { to: "string" }))
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
        for (let h of res.characters[c]) {
          if (h.mesh.length > 0) {
            let mesh = new THREE.Group()
            let min = new THREE.Vector3()
            let max = new THREE.Vector3()
            for (let m of h.mesh) {
              let part = objectLoader.parse(m)
              part.material = this.loadMaterial(part.userData.textureFile, res.chrtextures, part.userData.texture.texture)
              mesh.add(part)
              let geo = part.geometry
              geo.computeBoundingBox()
              min.min(geo.boundingBox.min)
              max.max(geo.boundingBox.max)
            }
            cache.push({helm: h.helm, mesh, min, max})
          }
        }
        this.chr_meshCache[c] = cache
      }
      this.chrtextures = res.chrtextures
      this.loadSpawns()
    })*/
  }

  loadSceneMaterials(scene) {
    scene.traverse(child => {
      if (child.userData.texture) {
        if (!(child.userData.texture in this.material_cache)) {
          let texInfo = scene.userData.textures[child.userData.texture]
          let texture = new THREE.Texture()
          texture.wrapS = THREE.RepeatWrapping
          texture.wrapT = THREE.RepeatWrapping
          let alpha = new THREE.Texture()
          alpha.wrapS = THREE.RepeatWrapping
          alpha.wrapT = THREE.RepeatWrapping
          alpha.magFilter = THREE.NearestFilter
          alpha.minFilter = THREE.NearestFilter
          if (texInfo.texturePaths) {
            let textureFile = texInfo.texturePaths[0].files[0].toLowerCase()
            jimp.read(`graphics/${store.getState().zone}/textures/${textureFile.substr(0, textureFile.indexOf('.'))}.png`).then(img => {
              img.getBase64Async(jimp.MIME_PNG).then(data => {
                let e = new Image()
                e.onload = () => {
                  texture.image = e
                  texture.needsUpdate = true
                }
                e.src = data
              })
              if (texInfo.texture.masked) {
                if (child.userData.texture.indexOf('FIRE') !== -1) {
                  img.greyscale((err, grey) => {
                    grey.scan(0, 0, img.bitmap.width, img.bitmap.height, function(x, y, idx) {
                      let val = Math.pow(this.bitmap.data[idx]/255, 1/4) * 255
                      this.bitmap.data[idx] = val
                      this.bitmap.data[idx+1] = val
                      this.bitmap.data[idx+2] = val
                    }, (err, newimg) => {
                      newimg.getBase64Async(jimp.MIME_PNG).then(data => {
                        let e = new Image()
                        e.onload = () => {
                          alpha.image = e
                          alpha.needsUpdate = true
                        }
                        e.src = data
                      })
                    })
                  })
                } else {
                  let idxTrans = [-1, -1, -1, -1]
                  let newTrans = true
                  img.scan(0, 0, img.bitmap.width, img.bitmap.height, function(x, y, idx) {
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
                  }, (err, newImg) => newImg.getBase64(jimp.MIME_PNG, (err, data) => {
                      let e = new Image()
                      e.onload = () => {
                        alpha.image = e
                        alpha.needsUpdate = true
                      }
                      e.src = data
                    })
                  )
                }
              }
            })
          }
          this.material_cache[child.userData.texture] =  new THREE.MeshLambertMaterial({
            ...(texture ? {map: texture} : {}),
            ...(texInfo.texture.masked ? {alphaMap: alpha} : {}),
            ...((!texInfo.texture.apparentlyNotTransparent || texInfo.texture.masked) ? {transparent: 1} : {}),
            ...(!texInfo.texture.apparentlyNotTransparent ? {opacity: 0} : {}),
            alphaTest: 0.8
          })
        }
        child.material = this.material_cache[child.userData.texture]
      }
    })
  }

  loadMaterial(textureName, textures, textureInfo, textureNumber = 0, textureFace = -1) {
    if (!textureName) return new THREE.MeshLambertMaterial()
    let vanillaTextureName = textureName
    if (textureNumber > 0) {
      if (textureNumber > 6) {
        textureNumber -= 6
      }
      textureName = textureName.substr(0, textureName.indexOf('0')) + (textureNumber < 10 ? "0" + textureNumber : textureNumber) + textureName.substr(textureName.indexOf('0') + 2)
      if (!(textureName in textures)) {
        textureName = vanillaTextureName
      }
    }
    if (textureName.indexOf('he', 3) !== -1 && (textureFace > 0 || textureFace === 0 && !(textureName in textures))) {
      textureName = vanillaTextureName.substr(0, 7) + textureFace + vanillaTextureName.substr(8)
      if (!(textureName in textures)) {
        textureName = vanillaTextureName
      }
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
    if (!textureRaw) return new MeshBasicMaterial()
    let textureBuffer = new Buffer(textureRaw)
    let alphaBuffer = new Buffer(textureRaw)
    if (alphaBuffer) {
      let textureType = String.fromCharCode(alphaBuffer.readInt8(0)) + String.fromCharCode(alphaBuffer.readInt8(1))
      if (textureType === 'BM' && textureInfo.masked) {
        //let bSize = alphaBuffer.readUInt16LE(2)
        //let bOffset = alphaBuffer.readUInt16LE(10)
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
      let npcTypesTint = []
      for (let se of this.spawnentry) {
        if (se.spawngroupID === spawn.spawngroupID) {
          spawnentry.push(se)
          for (let n of this.npcTypes) {
            if (se.npcID === n.id) {
              npcTypes.push(n)
              break
            }
          }
          for (let n of this.npcTypesTint) {
            if (se.npcID === n.id) {
              npcTypesTint.push(n)
            }
          }
        }
      }
      let npc = npcTypes[0]
      if (npc) {
        let npcTint = npcTypesTint[0]
        if (npcTint && npcTint.id !== npc.id) npcTint = null
        let genderName = npc.gender === 0 ? 'male' : npc.gender === 1 ? 'female' : 'neutral'
        let raceCode = raceCodes[npc.race][genderName]

        let geo = new THREE.CylinderGeometry(2 * npc.size > 0 ? npc.size/6.0 : 1, 2 * npc.size > 0 ? npc.size/6.0 : 1, 6 * npc.size > 0 ? npc.size/6.0 : 1)
        geo.rotateX(THREE.Math.degToRad(90))
        geo.translate(0, 0, 1)
        let mat = new THREE.MeshLambertMaterial({color: new THREE.Color(1, 1, 0).getHex(), transparent: true, opacity: 0, alphaTest: 0})
        let base = new THREE.Mesh(geo, mat)
        base.position.set(spawn.y, spawn.x, spawn.z /* - Helper.getZOffset(npc.race) */) // Offset
        base.userData.selectable = true
        base.userData.type = "SpawnPoint"
        base.userData.spawnInfo = spawn
        base.userData.spawngroup = spawngroup
        base.userData.spawnentry = spawnentry
        base.userData.npcTypes = npcTypes
        base.userData.npcTypesTint = npcTypesTint
        base.userData.size = npc.size
        base.userData.offset = 1
        
        if (this.chr_meshCache[raceCode]) {
          let char = this.chr_meshCache[raceCode]
          let helm = npc.helmtexture < 10 ? `HE0${parseInt(npc.helmtexture)}` : `HE${parseInt(npc.helmtexture)}`
          let min = new THREE.Vector3()
          let max = new THREE.Vector3()
          let group = new THREE.Group()
          for (let mesh of char) {
            if ((npc.texture <= 6 && mesh.helm === "BASE") || mesh.helm === helm || (npc.texture > 6 && mesh.helm === "BO01")) {
              let newmesh = mesh.mesh.clone().rotateOnAxis(new THREE.Vector3(0,0,1), THREE.Math.degToRad(spawn.heading - 90))
              if (npc.texture > 0 || npc.face > 0) {
                for (let c of newmesh.children) {
                  c.material = this.loadMaterial(c.userData.textureFile, this.chrtextures, c.userData.texture.texture, npc.texture, npc.face)
                  if (mesh.helm === "01" && c.userData.textureFile.indexOf('clk') !== -1 && npcTint && (npcTint.red2c > 0 || npcTint.blu2c > 0 || npcTint.grn2c > 0)) {
                    c.material = c.material.clone()
                    //c.material.color.setHex(0xFFFFFF)
                    c.material.color.setHex(parseInt(`0x${npcTint.red2c.toString(16)}${npcTint.grn2c.toString(16)}${npcTint.blu2c.toString(16)}`, 16))
                  }
                }
              }
              group.add(newmesh)
              min.min(mesh.min)
              max.max(mesh.max)
            }
          }
          let height = max.z - min.z
          let center = (min.z + max.z) / 2
          base.geometry.translate(0, 0, center - 1)
          group.scale.set(npc.size > 0 ? npc.size / height : 1, npc.size > 0 ? npc.size / height : 1, npc.size > 0 ? npc.size / height : 1)
          base.userData.offset = center
          base.add(group)
        }
        this.scene.add(base)
      }
    }
    this.onFinishLoading()
  }

  onViewportResize() {
    this.renderer.setSize( this.viewport.clientWidth, this.viewport.clientHeight )
  }
}
