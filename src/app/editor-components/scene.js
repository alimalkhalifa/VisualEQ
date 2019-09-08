import * as THREE from 'three'
import GLTFLoader from 'three-gltf-loader'
import jimp from 'jimp'
import { store } from '../store'
import { updatePosition, changeRenderer, changeScene } from '../store/actions'
import FlyCamera from './flyCamera'
import Selector from './selector'
import InfoBox from './infoBox'
import EventEmitter from 'events'
import raceCodes from '../../common/constants/raceCodeConstants.json'

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
    this.viewport = null
    this.loadingContainer = null
    this.material_cache = {}
    this.chr_meshCache = {}
    this.chrtextures = {}
    this.gifs = []
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

    this.scene.background = new THREE.Color().setHex(0x82eaff)
    this.scene.fog = new THREE.Fog(new THREE.Color().setHex(0x82eaff), 4000, 5000)

    this.clock = new THREE.Clock()
    this.scene.userData.clock = this.clock

    this.raycaster = new THREE.Raycaster()

    this.updateZoneInfo(true)
    this.updateZoneS3D()

    if (!store.getState().renderer) {
      let renderer = new THREE.WebGLRenderer()
      renderer.gammaOutput = true
      renderer.gammaFactor = 2.2
      this.viewport = document.getElementById('viewport')
      renderer.setSize( this.viewport.clientWidth, this.viewport.clientHeight )
      this.viewport.appendChild( renderer.domElement )
      store.dispatch(changeRenderer(renderer))
    }
    window.addEventListener('resize', this.onViewportResize)
    this.animate()
  }

  dispose() {
    window.removeEventListener('resize', this.onViewportResize)
    this.camera.disconnect()
    this.selector.disconnect()
    this.scene.dispose()
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
    loader.load(`graphics/${store.getState().zone}/${store.getState().zone}.glb`, gltf => {
      this.scene.add(gltf.scene)
      this.loadSceneMaterials(gltf.scene)
      loader.load(`graphics/${store.getState().zone}/${store.getState().zone}_obj.glb`, objgltf => {
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
      this.loadSpawns()
      this.onFinishLoading()
    }, xhr => {
      document.getElementById('loading-percentage').innerHTML = `${Math.round(xhr.loaded / xhr.total * 100)}% loaded`
    }, err => {
      console.error(err)
    })
  }

  loadSceneMaterials(scene) {
    let doneMaterials = []
    scene.traverse(child => {
      if (child.material && child.material.userData.textureAnimation && doneMaterials.indexOf(child.material) === -1) {
        let texture
        texture = new THREE.Texture()
        texture.wrapS = THREE.RepeatWrapping
        texture.wrapT = THREE.RepeatWrapping
        let anim = child.material.userData.textureAnimation
        jimp.read(`graphics/${store.getState().zone}/textures/${anim.frames[0]}`).then(img0 => {
          let gifImage = document.createElement('canvas')
          gifImage.width = img0.bitmap.width
          gifImage.height = img0.bitmap.height
          let ctx = gifImage.getContext('2d')
          ctx.fillStyle = '#CCCCCC'
          ctx.fillRect(0, 0, img0.bitmap.width, img0.bitmap.height)
          texture.image = gifImage
          texture.needsUpdate = true
          let frames = []
          for (let path of anim.frames) {
            let f = new Image()
            f.src = `graphics/${store.getState().zone}/textures/${path}`
            frames.push(f)
          }
          this.gifs.push({texture, gif: gifImage, ctx, frames, frameTime: anim.frameTime, currentTime: anim.frameTime, currentFrame: 0})
          child.material.map = texture
          doneMaterials.push(child.material)
        })
      }
    })
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
    store.getState().renderer.render(this.scene, this.camera.object)
    for (let g of this.gifs) {
      g.currentTime += delta * 1000
      if (g.currentTime > g.frameTime) {
        g.currentTime = 0
        g.currentFrame = (g.currentFrame + 1) % g.frames.length
        g.ctx.drawImage(g.frames[g.currentFrame], 0, 0)
        g.texture.needsUpdate = true
      }
    }
    store.dispatch(updatePosition(this.camera.object.position.toArray()))
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

        let geo = new THREE.SphereGeometry(2, 8, 8)//new THREE.CylinderGeometry(2 * npc.size > 0 ? npc.size/6.0 : 1, 2 * npc.size > 0 ? npc.size/6.0 : 1, 6 * npc.size > 0 ? npc.size/6.0 : 1)
        //geo.rotateX(THREE.Math.degToRad(90))
        //geo.translate(0, 0, 1)
        let mat = new THREE.MeshBasicMaterial({color: new THREE.Color(1, 1, 0), transparent: true, opacity: 0.5, alphaTest: 0.2})
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
        
        /*
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
        */
        this.scene.add(base)
      }
    }
    //this.onFinishLoading()
  }

  onViewportResize() {
    store.getState().renderer.setSize( this.viewport.clientWidth, this.viewport.clientHeight )
  }
}
