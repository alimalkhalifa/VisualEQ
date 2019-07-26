const THREE = require('three')
const fs = require('fs')

class WLDParser {

  createScene(zone, obj) {
    return this.loadWLD(zone.wld, zone.s3d, zone.obj, obj.wld, obj.s3d)
  }

  loadWLD(wld, s3d, obj, wldobj, objs3d) {
    return new Promise((resolve, reject) => {
      setImmediate(() => this.loadWLDAsync(wld, s3d, obj, wldobj, objs3d, (mesh) => {
        resolve(mesh)
      }))
    })
  }

  loadWLDAsync(wld, s3d, obj, wldobj, objs3d, cb) {
    let scene = new THREE.Scene()
    let meshCache = {}
    for (let fragIndex in wld) {
      let fragment = wld[fragIndex]
      if (fragment.type === "Mesh") {
        for (let mesh of this.loadWLDMesh(fragment, fragIndex, wld, s3d)) {
          mesh.userData.levelgeometry = true
          scene.add(mesh)
        }
      }
    }
    
    for (let i in wldobj) {
      let wldFrag = wldobj[i]
      if (wldFrag.type === "StaticModelRef") {
        let meshRef = wldFrag.meshReferences[0]
        let mesh = wldobj[wldobj[meshRef].mesh]
        let meshes = []
        for (mesh of this.loadWLDMesh(mesh, meshRef, wldobj, objs3d)) {
          mesh.userData.staticobject = true
          meshes.push(mesh.toJSON())
        }
        meshCache[wldFrag.name] = meshes
      }
    }

    let objectLocations = []
    for (let fragIndex in obj) {
      let fragment = obj[fragIndex]
      if (fragment.type === "ObjectLocation") {
        objectLocations.push({
          name: fragment.ref,
          position: [fragment.x,
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

    let textures = {}
    for (let i in s3d.files) {
      if (i.toLowerCase().indexOf('.bmp') !== -1) {
        textures[i] = s3d.files[i]
      }
    }
    let objtextures = {}
    for (let i in objs3d.files) {
      if (i.toLowerCase().indexOf('.bmp') !== -1) {
        objtextures[i] = objs3d.files[i]
      }
    }

    cb({
      scene: scene.toJSON(),
      meshCache,
      objectLocations,
      textures,
      objtextures
    })
  }

  loadChrMeshes(chrs) {
    return new Promise((resolve, reject) => {
      setImmediate(() => this.loadChrMeshesAsync(chrs, (characters) => {
        resolve(characters)
      }))
    })
  }

  loadChrMeshesAsync(chrs, cb) {
    let characters = {}
    let textures = {}
    for(let s3d of chrs) {
      let chr = s3d.wld
      for (let fragIndex in chr) {
        let fragment = chr[fragIndex]
        if (fragment.type === "StaticModelRef") {
          let raceCode = fragment.name.substr(0, fragment.name.indexOf('_'))
          console.log(`Loading ${raceCode}`)
          let skeletonFragment = chr[chr[fragment.meshReferences[0]].skeletonTrack]
          let entries = skeletonFragment ? skeletonFragment.entries : []
          if (entries.length > 0) {
            let stem = entries[0]
            this.walkSkeleton(chr, entries, stem)
          }
          let cache = []
          for (let i = 0; i < Object.keys(chr).length; i++) {
            let f = chr[i]
            if (f.type === "Mesh" && f.name.indexOf(raceCode) !== -1) {
              cache = cache.concat(this.loadWLDMesh(f, i, chr, s3d, entries))
            }
          }
          characters[raceCode] = cache
        }
      }
      for (let i in s3d.s3d.files) {
        if (i.toLowerCase().indexOf('.bmp') !== -1) {
          textures[i] = s3d.s3d.files[i]
        }
      }
    }
    cb({characters, textures})
  }

  walkSkeleton(chr, entries, bone, parentShift = new THREE.Vector3(), parentRot = new THREE.Euler(0, 0, 0, 'YXZ')) {
    let pieceRef = chr[bone.Fragment1]
    let piece = chr[pieceRef.skeletonPieceTrack]
    piece.shift = new THREE.Vector3(piece.shiftX[0], piece.shiftY[0], piece.shiftZ[0]).divideScalar(piece.shiftDenominator[0])
    piece.shift.applyEuler(parentRot)
    piece.shift.add(parentShift)
    let rotVector = new THREE.Vector3(piece.rotateX[0], piece.rotateY[0], piece.rotateZ[0]).divideScalar(piece.rotateDenominator).multiplyScalar(Math.PI / 2)
    rotVector.add(parentRot.toVector3())
    piece.rot = new THREE.Euler().setFromVector3(rotVector, 'YXZ')
    for (let b of bone.Data) {
      this.walkSkeleton(chr, entries,
        entries[b],
        piece.shift,
        piece.rot
      )
    }
  }

  loadWLDMesh(fragment, fragIndex, wld, s3d, skeletonEntries = []) {
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
        var mesh = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial({
          color: new THREE.Color(Math.random(), Math.random(), Math.random()).getHex()
        }))
        mesh.userData.fragIndex = fragIndex
        mesh.userData.fragment = fragment
        mesh.userData.textureFile = fragment.polygonTextures[polygonTexIndex].texturePaths ? fragment.polygonTextures[polygonTexIndex].texturePaths[0].files[0].toLowerCase() : null
        mesh.userData.texture = fragment.polygonTextures[polygonTexIndex]
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
 }

module.exports = {
  WLDParser
}

/*fetch(`/zone/s3d/${this.zoneShortName}`).then(res => {
  return res.json()
}).then(res => {
  console.log("Fetched zone Geometry")
  fetch(`/zone/s3d_obj/${this.zoneShortName}`).then(resobj => {
    return resobj.json()
  }).then(resobj => {
    console.log("Fetched zone object Geometry")
    this.loadWLD(res.wld, res.s3d, res.obj, resobj.wld, resobj.s3d, this.onFinishLoading.bind(this))
  })
})*/