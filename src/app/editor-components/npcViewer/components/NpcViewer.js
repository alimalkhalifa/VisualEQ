import React from 'react'
import * as THREE from 'three'
import GLTFLoader from 'three-gltf-loader'
import path from 'path'

class NpcViewer extends React.Component {
  render() {
    return (
      <div ref={ref => (this.mount = ref)} style={{
        width: '100%',
        height: '300px'
      }}>
      </div>
    )
  }
  componentDidMount() {
    this.scene = new THREE.Scene()
    this.scene.background = new THREE.Color(0x111111)
    this.camera = new THREE.PerspectiveCamera(70, this.mount.clientWidth / this.mount.clientHeight, 1, 100)
    this.camera.up.set(0, 0, 1)
    let quat = new THREE.Quaternion()
    quat.setFromAxisAngle(new THREE.Vector3(1, 0, 0), Math.PI / 2)
    this.camera.quaternion.copy(quat)
    this.camera.position.set(10, 0, 0)
    this.camera.lookAt(0, 0, 0)
    this.scene.add(this.camera)
    let loader = new GLTFLoader()
    loader.load(`graphics/characters/${this.props.race}.glb`, gltf => {
      console.log(this.props.texture)
      this.subject = gltf.scene
      this.subject.traverse(mesh => {
        if (mesh.name.indexOf('HE', 3) !== -1) {
          let helm = parseInt(mesh.name.substr(5, 2))
          if (helm !== this.props.helm) {
            mesh.visible = false
          }
        } else {
          if (this.props.texture <= 10) {
            if (mesh.name.length !== 0 && mesh.name.length !== 3 && mesh.name.indexOf('mesh') === -1 && mesh.name.charAt(3) !== '_' && mesh.name.charAt(3) !== 'H') {
              mesh.visible = false
            }
          } else {
            if (mesh.name.length !== 0 && mesh.name.length !== 3 && mesh.name.indexOf('mesh') === -1 && mesh.name.charAt(3) === '_') {
              mesh.visible = false
            }
          }
        }
        if (mesh.material && mesh.visible && mesh.parent.visible && this.props.texture > 0) {
          let name = mesh.name.indexOf('mesh') !== -1 ? mesh.parent.name : mesh.name
          let body = false
          if (this.props.texture > 10) body = true
          let texture = (name.length !== 0 && name.length !== 3 && name.charAt(3) !== '_' && name.charAt(3) !== 'H') ? this.props.texture - 6 : this.props.texture
          let src = mesh.material.map.image.src
          let base = path.basename(src)
          let url = src.substr(0, src.indexOf(base))
          let newbase
          if (name.indexOf('HE', 3) !== -1) {
            newbase = base.replace(/(0000)/, (sub) => {
              let face = String(this.props.face)
              while (face.length < sub.length) {
                face = '0' + face
              }
              return face
            })
          } else if (body && base.indexOf(this.props.race.toLowerCase()) !== -1) {
            newbase = base
          } else {
            if (isNaN(parseInt(base.charAt(3)))) {
              newbase = base.replace(/(00)/, (sub) => {
                let tex = String(texture)
                while (tex.length < sub.length) {
                  tex = '0' + tex
                }
                return tex
              })
            } else {
              newbase = base.substr(0, 3)
              let startNum = parseInt(base.substr(3, 2))
              newbase += String(texture)
              newbase += base.substr(5)
            }
          }
          url += newbase
          mesh.material.map.image.onload = () => {
            mesh.material.map.needsUpdate = true
          }
          mesh.material.map.image.src = url
        }
      })
      this.scene.add(this.subject)
    })
    this.clock = new THREE.Clock()
    this.renderer = new THREE.WebGLRenderer()
    this.renderer.gammaOutput = true
    this.renderer.gammaFactor = 2.2
    this.renderer.setSize(this.mount.clientWidth, this.mount.clientHeight)
    this.mount.appendChild(this.renderer.domElement)
    this.animate()
  }
  componentWillUnmount() {
    this.scene.dispose()
    this.renderer.forceContextLoss()
    this.renderer.context = null
    this.renderer.domElement = null
    this.renderer.dispose()
  }
  animate() {
    requestAnimationFrame(() => this.animate())
    let delta = this.clock.getDelta()
    if (this.subject) this.subject.rotateZ(delta * Math.PI / 4)
    this.renderThree()
  }
  renderThree() {
    this.renderer.render(this.scene, this.camera)
  }
}

export default NpcViewer