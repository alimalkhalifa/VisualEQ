import * as THREE from 'three'
import { store } from '../store';
import { updateSelected, moveObject, moveUndo } from '../store/actions';
import { Quaternion } from 'three';

export default class Selector {
  constructor() {
    this.mousePos = new THREE.Vector2()
    this.mouseDrag = false
    this.mouseDown = false
    this.dragHandle = null
    this.dragPlane = null
    this.dragOffsetMet = false
    this.dragPlaneSize = 10000
    this.handleOffset = 5
    this.handleSize = 1
    this.ghandleClickCount = 0
    this.ghandleClickCountReset = null
    this.resetDoubleClickDelay = 1000 //ms
    this.mouseDragThreshold = 2
    this.objectStartPos = new THREE.Vector3()
    this.objectOrigin = new THREE.Vector3()
    this.objectHeight = 0
    this.holdCtrl = false
    this.viewport = null
    this.connect()
  }

  connect() {
    this.viewport = document.getElementById("viewport")
    document.addEventListener('mousedown', this.onMouseDown.bind(this))
    document.addEventListener('mouseup', this.onEndMouseDown.bind(this))
    document.addEventListener('mousemove', this.onMouseMove.bind(this))
    document.addEventListener('keypress', this.onKeyPress.bind(this))
  }

  onMouseDown() {
    if ( event.target !== store.getState().scene.renderer.domElement ) return
    if ( this.mouseDown ) return
    if (event.button !== 0) return
    this.mouseDown = true
    let selfSelect = false
    let intersections = this.raycastFromCamera()
    if (intersections.length > 0) {
      for (let i of intersections) {
        if (i.object.userData.draggable) {
          if (i.object.userData.ghandle) {
            if (this.ghandleClickCount >= 1) {
              this.ghandleClickCount = 0
              clearTimeout(this.ghandleClickCountReset)
              let selectedObject = store.getState().selected
              let floor = this.getObjectPositionOnFloor(selectedObject)
              if (!floor.err) {
                selectedObject.position.copy(floor.pos.add(new THREE.Vector3(0, 0, selectedObject.userData.size / 2 - selectedObject.userData.offset)))
                this.objectOrigin.copy(selectedObject.position)
                this.setGHandleToFloor(selectedObject)
              } else {
                let ceiling = this.getObjectPositionOnCeiling(selectedObject)
                if (!ceiling.err) {
                  let floor2 = this.getPointPositionOnLastFloor(ceiling.pos)
                  if (!floor2.err) {
                    selectedObject.position.copy(floor2.pos.add(new THREE.Vector3(0, 0, selectedObject.userData.size / 2 - selectedObject.userData.offset)))
                    this.objectOrigin.copy(selectedObject.position)
                    this.setGHandleToFloor(selectedObject)
                  }
                }
              }
              return
            } else {
              this.ghandleClickCount += 1
              this.ghandleClickCountReset = setTimeout(this.resetDoubleClick.bind(this), this.resetDoubleClickDelay)
            }
          } else {
            this.ghandleClickCount = 0
            clearTimeout(this.ghandleClickCountReset)
            this.dragPlane = new THREE.Mesh(new THREE.PlaneGeometry(this.dragPlaneSize, this.dragPlaneSize), new THREE.MeshBasicMaterial({color: 0xFFFF00, transparent: true, opacity: 0, alphaTest: 0.1}))
            this.dragPlane.userData.dragplane = true
            this.dragPlane.position.copy(new THREE.Vector3().copy(i.object.position).add(store.getState().selected.position))
            if (i.object.userData.zhandle) {
              this.dragPlane.rotateOnAxis(new THREE.Vector3(1, 0, 0), THREE.Math.degToRad(90))
            }
            store.getState().scene.scene.add(this.dragPlane)
          }
          this.mouseDrag = true
          this.dragHandle = i.object
          return
        } else if (i.object.userData.selectable) {
          selfSelect = true
          this.ghandleClickCount = 0
          clearTimeout(this.ghandleClickCountReset)
          this.changeSelectedObject(i.object)
          this.objectOrigin.copy(i.object.position)
          return
        }
      }
    }
    if (!selfSelect) this.nullSelectedObject()
  }

  onMouseMove(event) {
    let rect = this.viewport.getBoundingClientRect()
    this.mousePos.x = ((event.clientX - rect.left) / rect.width) * 2 - 1
    this.mousePos.y = -((event.clientY - rect.top) / rect.height) * 2 + 1

    if (this.mouseDrag && this.dragHandle) {
      let intersections = this.raycastFromCamera()
      for (let i of intersections) {
        if ((this.dragHandle.userData.ghandle && i.object.userData.levelgeometry) || (!this.dragHandle.userData.ghandle && i.object.userData.dragplane)) {
          if (this.dragOffsetMet || i.point.distanceTo(new THREE.Vector3().copy(this.objectOrigin).add(this.dragHandle.position)) > this.mouseDragThreshold) {
            this.dragOffsetMet = true
            store.getState().selected.position.copy(new THREE.Vector3().copy(this.objectOrigin).add(i.point.sub(this.dragHandle.position).sub(this.objectOrigin).multiply(this.dragHandle.userData.dragScale)))
            this.setGHandleToFloor(store.getState().selected)
            return
          }
        }
      }
    }
  }

  onEndMouseDrag(event) {
    if (event.button !== 0 || !this.mouseDrag) return
    this.mouseDrag = false
    let selectedObject = store.getState().selected
    store.dispatch(moveObject(selectedObject, new THREE.Vector3().copy(this.objectOrigin), new THREE.Vector3().copy(selectedObject.position)))
    this.setGHandleToFloor(selectedObject)
    store.getState().scene.scene.remove(this.dragPlane)
    this.dragPlane = null
    this.objectOrigin.copy(selectedObject.position)
    this.dragOffsetMet = false
  }

  onEndMouseDown(event) {
    if ( event.target !== store.getState().scene.renderer.domElement ) return
    if (!this.mouseDown) return
    this.mouseDown = false
    if (event.button === 0) {
      if (this.mouseDrag) {
        this.onEndMouseDrag(event)
      }
    }
  }

  resetDoubleClick() {
    this.ghandleClickCount = 0
  }

  onKeyPress(event) {
    if (event.keyCode === 26) { // Control-Z
      this.undoLastMove()
    }
  }

  nullSelectedObject() {
    let selectedObject = store.getState().selected
    if (selectedObject !== null) {
      // selectedObject.material = selectedObject.userData.defaultMaterial
      selectedObject.userData.selectable = selectedObject.userData.defaultSelectable
      if (selectedObject.userData.handles) {
        this.dragHandle = null
        for (let h of selectedObject.userData.handles) {
          selectedObject.remove(h)
        }
      }
    }
    store.dispatch(updateSelected(null))
  }

  changeSelectedObject(object) {
    this.nullSelectedObject()
    if (object.userData.selectable) {
      store.dispatch(updateSelected(object))
      // object.userData.defaultMaterial = object.material
      // object.material = new THREE.MeshBasicMaterial({color: 0x00FF00, transparent: true, opacity: 0.2})
      object.userData.defaultSelectable = object.userData.selectable
      object.userData.selectable = false
      let xhandle = new THREE.Mesh(new THREE.BoxGeometry(this.handleSize, this.handleSize, this.handleSize), new THREE.MeshBasicMaterial({color: 0xFF0000}))
      xhandle.position.set(this.handleOffset, 0, 0)
      xhandle.userData.draggable = true
      xhandle.userData.dragScale = new THREE.Vector3(1, 0, 0)
      let yhandle = new THREE.Mesh(new THREE.BoxGeometry(this.handleSize, this.handleSize, this.handleSize), new THREE.MeshBasicMaterial({color: 0x00FF00}))
      yhandle.position.set(0, this.handleOffset, 0)
      yhandle.userData.draggable = true
      yhandle.userData.dragScale = new THREE.Vector3(0, 1, 0)
      let zhandle = new THREE.Mesh(new THREE.BoxGeometry(this.handleSize, this.handleSize, this.handleSize), new THREE.MeshBasicMaterial({color: 0x0000FF}))
      zhandle.position.set(0, 0, this.handleOffset)
      zhandle.userData.draggable = true
      zhandle.userData.dragScale = new THREE.Vector3(0, 0, 1)
      zhandle.userData.zhandle = true
      let ghandle = new THREE.Mesh(new THREE.BoxGeometry(this.handleSize * 0.9, this.handleSize * 0.9, this.handleSize * 0.9), new THREE.MeshBasicMaterial({color: 0xFFFF00}))
      ghandle.position.set(0, 0, -this.handleOffset)
      ghandle.userData.draggable = true
      ghandle.userData.ghandle = true
      ghandle.userData.dragScale = new THREE.Vector3(1, 1, 1)
      let xlinegeo = new THREE.Geometry()
      xlinegeo.vertices.push(new THREE.Vector3(0, 0, 0))
      xlinegeo.vertices.push(new THREE.Vector3(this.handleOffset, 0, 0))
      let xline = new THREE.Line(xlinegeo, new THREE.MeshBasicMaterial({color: 0xFF0000}))
      let ylinegeo = new THREE.Geometry()
      ylinegeo.vertices.push(new THREE.Vector3(0, 0, 0))
      ylinegeo.vertices.push(new THREE.Vector3(0, this.handleOffset, 0))
      let yline = new THREE.Line(ylinegeo, new THREE.MeshBasicMaterial({color: 0x00FF00}))
      let zlinegeo = new THREE.Geometry()
      zlinegeo.vertices.push(new THREE.Vector3(0, 0, 0))
      zlinegeo.vertices.push(new THREE.Vector3(0, 0, this.handleOffset))
      let zline = new THREE.Line(zlinegeo, new THREE.MeshBasicMaterial({color: 0x0000FF}))
      let ringgeo = new THREE.RingGeometry(3, 4)
      let ring = new THREE.Mesh(ringgeo, new THREE.MeshBasicMaterial({color: 0xFFFF00}))
      ring.position.copy(new THREE.Vector3(0, 0, -object.userData.size/2 + object.userData.offset + 0.1))
      object.userData.handles = [xhandle, yhandle, zhandle, ghandle, xline, yline, zline, ring]
      for (let h of object.userData.handles) {
        object.add(h)
      }
      this.setGHandleToFloor(object)
    }
  }

  isSelectedObject(object) {
    return object === store.getState().selected
  }

  getObjectPositionOnFloor(object) {
    let intersections = this.raycastToFloor(object)
    if (intersections.length === 0) return {err: "No floor"}
    let floor = null
    for (let i of intersections) {
      if (i.object.userData.levelgeometry) {
        floor = i
        break
      }
    }
    if (floor) {
      return {
        pos: floor.point,
        h: floor.distance
      }
    } else return {err: "No floor"}
  }

  getPointPositionOnLastFloor(point) {
    let intersections = this.raycastFromPointToFloor(point)
    if (intersections.length === 0) return {err: "No floor"}
    let floor = null
    for (let i of intersections) {
      if (i.object.userData.levelgeometry) {
        floor = i
      }
    }
    if (floor) {
      return {
        pos: floor.point,
        h: floor.distance
      }
    } else return {err: "No floor"}
  }

  getObjectPositionOnCeiling(object) {
    let intersections = this.raycastToCeiling(object)
    if (intersections.length === 0) return {err: "No Ceiling"}
    let ceiling = null
    for (let i of intersections) {
      if (i.object.userData.levelgeometry) {
        ceiling = i
        break
      }
    }
    if (ceiling) {
      return {
        pos: ceiling.point,
        h: ceiling.distance
      }
    } else return {err: "No Ceiling"}
  }

  setGHandleToFloor(object) {
    let floor = this.getObjectPositionOnFloor(object)
    if (!floor.err) {
      object.userData.handles[3].position.set(0, 0, -floor.h)
    } else {
      let ceiling = this.getObjectPositionOnCeiling(object)
      if (!ceiling.err) {
        let floor2 = this.getPointPositionOnLastFloor(ceiling.pos)
        if (!floor2.err) object.userData.handles[3].position.set(0, 0, ceiling.h - floor2.h)
      }
    }
  }

  raycastToFloor(object) {
    let scene = store.getState().scene
    scene.raycaster.set(object.position, new THREE.Vector3(0, 0, -1))
    let intersections = scene.raycaster.intersectObjects(scene.scene.children, true)
    return intersections
  }

  raycastFromPointToFloor(point) {
    let scene = store.getState().scene
    scene.raycaster.set(point, new THREE.Vector3(0, 0, -1))
    let intersections = scene.raycaster.intersectObjects(scene.scene.children, true)
    return intersections
  }

  raycastToCeiling(object) {
    let scene = store.getState().scene
    scene.raycaster.set(object.position, new THREE.Vector3(0, 0, 1))
    let intersections = scene.raycaster.intersectObjects(scene.scene.children, true)
    return intersections
  }

  raycastFromCamera() {
    let scene = store.getState().scene
    scene.raycaster.setFromCamera(this.mousePos, scene.camera.object)
    let intersections = scene.raycaster.intersectObjects(scene.scene.children, true)
    return intersections
  }

  undoLastMove() {
    let move = store.getState().moves.slice(-1)
    if (move.length > 0) {
      move[0].object.position.copy(move[0].from)
      if (store.getState().selected === move[0].object) {
        this.setGHandleToFloor(store.getState().selected)
        this.objectOrigin.copy(store.getState().selected.position)
      }
      store.dispatch(moveUndo())
    }
  }
}
