const THREE = require('three')
const { Image } = require('canvas')

module.exports = function loadMesh(fragment, wld, materialCache, imageCache, skeletonEntries = []) {
  fragment.textureListRef = wld[fragment.textureList]
  for (let t in fragment.polygonTextures) {
    fragment.polygonTextures[t].texture = wld[fragment.textureListRef.textureInfoRefsList[fragment.polygonTextures[t].textureIndex]]
    let textureInfoRef = wld[fragment.polygonTextures[t].texture.textureInfoRef]
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
      // console.log(skelPiece) // ANIMATION DEBUG
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
  let scale = 1.0 / (1 << fragment.scale)
  let centerX = fragment.centerX
  let centerY = fragment.centerY
  let centerZ = fragment.centerZ
  var geometry = new THREE.BufferGeometry()
  let vertices = []
  let normals = []
  let uvs = []
  let colors = []
  let indices = []
  for (let v of fragment.vertices) {
    vertices.push(v.x * scale + centerX, v.y * scale + centerY, v.z * scale + centerZ)
  }
  for (let n of fragment.vertexNormals) {
    normals.push(n.x, n.y, n.z)
  }
    let uvDivisor = 256.0
  if (fragment.texCoordsCount > 0) {
    for (let u of fragment.textureCoords) {
      uvs.push(u.x / uvDivisor, -u.z / uvDivisor)
    }
  }
  if (fragment.colorCount > 0) {
    for (let cHex of fragment.vertexColors) {
      let c = new THREE.Color(cHex)
      colors.push(c.r, c.g, c.b)
    }
  }
  for (let p of fragment.polygons) {
    indices.push(p.vertex3, p.vertex2, p.vertex1)
  }
  geometry.setIndex(indices)
  geometry.addAttribute('position', new THREE.Float32BufferAttribute(vertices, 3))
  geometry.addAttribute('normal', new THREE.Float32BufferAttribute(normals, 3))
  geometry.addAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2))
  //if (colors.length > 0) geometry.addAttribute('color', new THREE.Float32BufferAttribute(colors, 3))
  geometry.normalizeNormals()
  let groupStart = 0
  let textures = []
  let skip = 0
  for (let i = 0; i < fragment.polygonTexCount; i++) {
    if (fragment.polygonTextures[i].texturePaths) {
      geometry.addGroup(
        groupStart*3,
        fragment.polygonTextures[i].polygonCount*3,
        i - skip
      )
      groupStart += fragment.polygonTextures[i].polygonCount
      if (fragment.polygonTextures[i].texturePaths) {
        textures.push({
          texture: fragment.polygonTextures[i].texture,
          textureInfo: fragment.polygonTextures[i].textureInfo,
          texturePaths: fragment.polygonTextures[i].texturePaths
        })
      }
    } else {
      skip += 1
    }
  }
  geometry.computeBoundingBox()
  //geometry.computeBoundingSphere()
  let materials = []
  for (let texture of textures) {
    if (!(texture.texture.name in materialCache)) {
      let imgPath = texture.texture.masked ?
        `textures/${texture.texturePaths[0].files[0].substr(0, texture.texturePaths[0].files[0].indexOf('.')).toLowerCase()}_alpha.png` :
        `textures/${texture.texturePaths[0].files[0].substr(0, texture.texturePaths[0].files[0].indexOf('.')).toLowerCase()}.png`
      if (!(imgPath in imageCache)) {
        let img = new Image()
        img.src = imgPath
        imageCache[imgPath] = img
      }
      let tex = new THREE.Texture(imageCache[imgPath])
      tex.wrapS = THREE.RepeatWrapping
      tex.wrapT = THREE.RepeatWrapping
      tex.magFilter = THREE.LinearFilter
      tex.minFilter = THREE.LinearFilter
      //console.log(fs.statSync(path))
      let material = new THREE.MeshBasicMaterial({
        ...(tex ? {map: tex} : {}),
        //...((texture.texture.masked && alpha) ? {alphaMap: alpha} : {}),
        ...((!texture.texture.apparentlyNotTransparent || texture.texture.masked) ? {transparent: 1} : {}),
        ...(!texture.texture.apparentlyNotTransparent ? {opacity: 0} : {}),
        ...((texture.texture.masked) ? {alphaTest: 0.8} : {}),
      })
      if (texture.textureInfo.animatedFlag) {
        let frames = []
        for (let framePath of texture.texturePaths) {
          let p = texture.texture.masked ?
          `${framePath.files[0].substr(0, framePath.files[0].indexOf('.')).toLowerCase()}_alpha.png` :
            `${framePath.files[0].substr(0, framePath.files[0].indexOf('.')).toLowerCase()}.png`
          frames.push(p)
        }
        let frameTime = texture.textureInfo.frameTime
        material.userData.textureAnimation = {
          name: texture.texture.name,
          frames,
          frameTime
        }
      }
      materialCache[texture.texture.name] = material
    }
    materials.push(materialCache[texture.texture.name])
  }
  if (materials.length === 0) {
    materials = new THREE.MeshBasicMaterial({
      opacity: 0,
      transparent: true
    })
  }
  let mesh = new THREE.Mesh(geometry, materials)
  mesh.name = fragment.name
  return mesh
}