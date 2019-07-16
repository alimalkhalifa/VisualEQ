import * as THREE from 'three'
import store from '../store'
import {
  addSpawn
} from '../store/actions'
import FlyCamera from './flyCamera'

export default class Scene {
  constructor(zoneShortName) {
    this.zoneShortName = zoneShortName
    this.infoBox = document.getElementById('info-box')
    this.scene = null
    this.camera = null
    this.ambientLight = null
    this.clock = null
    this.raycaster = null
    this.zoneInfo = {}
    this.renderer = null
    this.selectedObject = null
    this.Init()
  }

  Init() {
    this.scene =  new THREE.Scene()
    this.camera = new FlyCamera()
    this.scene.add(this.camera.camera)
    this.camera.updateCameraRotation()

    this.ambientLight = new THREE.AmbientLight( 0xffffff, 1 );
    this.scene.add( this.ambientLight );
    this.scene.background = new THREE.Color().setHex(0x82eaff);
    this.scene.fog = new THREE.Fog(new THREE.Color().setHex(0x82eaff), 600, 1000)

    this.clock = new THREE.Clock()

    this.raycaster = new THREE.Raycaster()

    this.updateZoneInfo(true)
    this.updateZoneS3D()

    this.renderer = new THREE.WebGLRenderer();
    this.renderer.setSize( window.innerWidth, window.innerHeight );
    document.getElementById('viewport').appendChild( this.renderer.domElement );
    window.addEventListener('resize', this.onViewportResize.bind(this), false)
    document.addEventListener('keydown', this.onKeyDown.bind(this), false)
    document.addEventListener('keyup', this.onKeyUp.bind(this), false)
    document.addEventListener('mousemove', this.onMouseMove.bind(this), false)
    document.addEventListener('mousedown', this.onMouseDown.bind(this), false)
    document.addEventListener('mouseup', this.onMouseUp.bind(this), false)
    document.addEventListener('pointerlockchange', this.onPointerLockChange.bind(this), false)

    this.animate()
  }

  updateZoneInfo(goToHome = false) {
    fetch(`/zone/shortname/${this.zoneShortName}`).then(res => {
      return res.json()
    }).then(res => {
      console.log(`Zone Info fetched: ${res[0].long_name}`)
      this.zoneInfo = res[0]
      //scene.fog = new THREE.Fog(new Three.COLOR(zoneInfo.fog_red, zoneInfo.fog_green, zoneInfo.fog_blue).getHEX(), zoneInfo.fog_minclip, zoneInfo.fog_maxclip)
      if (goToHome) {
        this.camera.camera.position.set(this.zoneInfo.safe_y, this.zoneInfo.safe_x, this.zoneInfo.safe_z+2)
      }
      this.getSpawns()
    })
  }

  updateZoneS3D() {
    fetch('/zone/s3d/crushbone').then(res => {
      return res.json()
    }).then(res => {
      console.log("Fetched zone Geometry")
      let wld = res.wld
      for (let fragIndex in wld) {
        let fragment = wld[fragIndex]
        if (fragment.type === "Mesh") {
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
              let textureRaw = res.s3d.files[fragment.polygonTextures[polygonTexIndex].texturePaths[0].files[0].toLowerCase()]
              let textureData = new Buffer(textureRaw).toString('base64')
              let textureURI = `data:image/bmp;base64,${textureData}`
              let texture = new THREE.Texture()
              texture.wrapS = THREE.RepeatWrapping
              texture.wrapT = THREE.RepeatWrapping
              let image = new Image()
              image.onload = () => {
                texture.image = image
                texture.needsUpdate = true
              }
              image.src = textureURI
              let material = new THREE.MeshLambertMaterial({
                map: texture,
                transparent: fragment.polygonTextures[polygonTexIndex].texture.transparent,
                opacity: (fragment.polygonTextures[polygonTexIndex].texture.transparent? 0 : 1)
              })
              var mesh = new THREE.Mesh(geometry, material)
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
      }
    })
  }

  animate() {
    requestAnimationFrame(() => this.animate())
    this.render()
  }

  render() {
    let delta = this.clock.getDelta()
    this.renderer.render(this.scene, this.camera.camera)
    this.camera.updateCamera(this.camera.camera, this.camera.cameraMovementInput, delta)
    this.lockPointer()
    this.raycastSelect()
    this.consumeMouseJustState()
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
    this.camera.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize( window.innerWidth, window.innerHeight );
  }

  lockPointer() {
    if (this.camera.mouseState[2] === true && !this.camera.mouseLocked) {
      this.renderer.domElement.requestPointerLock()
    } else if (this.camera.mouseState[2] === false && this.camera.mouseLocked) {
      document.exitPointerLock()
    }
  }

  onPointerLockChange(_) {
    if (document.pointerLockElement === this.renderer.domElement || document.mozPointerLockElement === this.renderer.domElement) {
      this.camera.mouseLocked = true
    } else {
      this.camera.mouseLocked = false
    }
  }

  raycastSelect() {
    if (this.camera.mouseJustState[0] && !this.camera.mouseLocked) {
      this.raycaster.setFromCamera(this.camera.mousePos, this.camera.camera)
      let intersections = this.raycaster.intersectObjects(this.scene.children, true)
      if (intersections.length > 0) {
        this.changeSelectedObject(intersections[0].object)
      } else {
        this.nullSelectedObject()
      }
    }
  }
  
  consumeMouseJustState() {
    this.camera.mouseJustState = [false, false, false]
  }

  onKeyDown( event ) {
    switch ( event.keyCode ) {
      case 87: /*W*/
        this.camera.cameraMovementInput.forward = 1
        break;
      case 65: /*A*/
        this.camera.cameraMovementInput.left = 1
        break;
      case 83: /*S*/
        this.camera.cameraMovementInput.back = 1
        break;
      case 68: /*D*/
        this.camera.cameraMovementInput.right = 1
        break;
      case 81: // Q
        this.camera.cameraMovementInput.up = 1
        break;
      case 90: // Z
        this.camera.cameraMovementInput.down = 1
        break;
      case 16: // Shift
        this.camera.doubleSpeed = true
        break;
      default:
        console.log(`${event.keyCode} not bound`)
    }
  }

  onKeyUp( event ) {
    switch ( event.keyCode ) {
      case 87: /*W*/
        this.camera.cameraMovementInput.forward = 0
        break;
      case 65: /*A*/
        this.camera.cameraMovementInput.left = 0
        break;
      case 83: /*S*/
        this.camera.cameraMovementInput.back = 0
        break;
      case 68: /*D*/
        this.camera.cameraMovementInput.right = 0
        break;
      case 81: // Q
        this.camera.cameraMovementInput.up = 0
        break;
      case 90: // Z
        this.camera.cameraMovementInput.down = 0
        break;
      case 16: // Shift
        this.camera.doubleSpeed = false
        break;
    }
  }

  onMouseDown(event) {
    if ( event.target !== this.renderer.domElement ) {
      return
    }
    this.camera.mouseState[event.button] = true
    this.camera.mouseJustState[event.button] = true
  }

  onMouseUp(event) {
    this.camera.mouseState[event.button] = false
  }

  onMouseMove(event) {
    this.camera.mousePos.x = ( event.clientX / window.innerWidth ) * 2 - 1
    this.camera.mousePos.y = - ( event.clientY / window.innerHeight ) * 2 + 1
  
    if (!this.camera.mouseLocked) {
      return
    }
    
    let mouseMoveX = event.movementX || event.mozMovementX || event.webkitMovementX || 0
    let mouseMoveY = event.movementY || event.mozMovementY || event.webkitMovementY || 0
  
    this.camera.cameraRotation -= mouseMoveX * this.camera.cameraRotationSpeed
    this.camera.cameraPitch -= mouseMoveY * this.camera.cameraRotationSpeed
    this.camera.cameraPitch = Math.max(-(Math.PI/2), Math.min( (Math.PI/2), this.camera.cameraPitch))
    this.camera.updateCameraRotation()
  }

  nullSelectedObject() {
    if (this.selectedObject !== null) {
      this.selectedObject.material = this.selectedObject.userData.defaultMaterial
    }
    this.infoBox.style.visibility = "hidden"
  }
  
  changeSelectedObject(object) {
    this.nullSelectedObject()
    if (object.userData.selectable) {
      this.selectedObject = object
      this.selectedObject.userData.defaultMaterial = this.selectedObject.material
      this.selectedObject.material = new THREE.MeshBasicMaterial({color: 0x00FF00})
      if (object.userData.type === "SpawnPoint") {
        let spawn = object.userData.spawnInfo
        this.infoBox.innerHTML = `
          <div class="card text-white bg-dark">
            <div class="card-body">
              <h5 class="card-title">Spawn</h5>
              <h6 class="card-subtitle mb2 text-muted">ID ${spawn.id}</h6>
            </div>
          </div>
          <div class="card text-white bg-dark">
            <div class="card-body">
              <h5 class="card-title">Position</h5>
              <div class="card-text">
                X: ${spawn.x}<br/>
                Y: ${spawn.y}<br/>
                Z: ${spawn.z}<br/>
                H: ${spawn.heading}<br/>
              </div>
            </div>
          </div>
          <div class="card text-white bg-dark">
            <div class="card-body">
              <h5 class="card-title">Attributes</h5>
              <div class="card-text">
                Enabled: ${spawn.enabled}<br/>
                Pathgrid: ${spawn.pathgrid}</br>
                RespawnTime: ${spawn.respawntime}</br>
                Variance: ${spawn.variance}<br/>
              </div>
            </div>
          </div>
        `
        this.getSpawnGroup(spawn.spawngroupID)
      }
      this.infoBox.style.visibility = "visible"
    }
  }

  getSpawnGroup(id) {
    fetch(`/spawngroup/group/${id}`).then(res => {
      return res.json()
    }).then(res => {
      let group = res[0]
      let card = document.createElement("div")
      card.setAttribute("class", "card text-white bg-dark")
      card.innerHTML = `
        <div class="card-body">
          <h5 class="card-title">Spawngroup</h5>
          <h6 class="card-subtitle mb2 text-muted">ID ${group.id}</h6>
          <div class="card-text">
            Name: ${group.name}<br/>
            Spawn Limit: ${group.spawn_limit}<br/>
            Distance: ${group.dist}<br/>
            Max X: ${group.max_x}<br/>
            Min X: ${group.min_x}<br/>
            Max Y: ${group.max_y}<br/>
            Min Y: ${group.min_y}<br/>
            Delay: ${group.delay}<br/>
            Minimum Delay: ${group.mindelay}<br/>
            Despawn: ${group.despawn}<br/>
            Despawn Timer: ${group.despawn_timer}<br/>
          </div>
        </div>
      `
      this.infoBox.appendChild(card)
      this.getSpawnEntries(id)
    })
  }

  getSpawnEntries(id) {
    fetch(`/spawngroup/entry/${id}`).then(res => {
      return res.json()
    }).then(res => {
      for (let entry of res) {
        let card = document.createElement("div")
        card.setAttribute("class", "card text-white bg-dark")
        card.innerHTML = `
        <h5 class="card-title">Spawn Entry</h5>
        <div class="card-text">
          npcID: ${entry.npcID}<br/>
          Chance: ${entry.chance}<br/>
        </div>
        `
        this.infoBox.appendChild(card)
        this.getNPC(entry.npcID)
      }
    })
  }

  getNPC(id) {
    fetch(`/npc/${id}`).then(res => {
      return res.json()
    }).then(res => {
      let npc = res[0]
      let card = document.createElement("div")
      card.setAttribute("class", "card text-white bg-dark")
      card.innerHTML = `
      <h5 class="card-title">NPC</h5>
      <h6 class="card-subtitle mb2 text-muted">ID ${npc.id}</h6>
      <div class="card-text">
        Name: ${npc.name}<br/>
      </div>
      `
      this.infoBox.appendChild(card)
    })
  }
}