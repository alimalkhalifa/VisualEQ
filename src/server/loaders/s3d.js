const fs = require('fs')
const zlib = require('pako')
const { StringDecoder } = require('string_decoder')

module.exports = function(fileName, cb) {
  let filePath = `./zones/${fileName}`
  fs.readFile(filePath, (err, file) => {
    if (err) throw err
    console.log(`Loading S3D`)
    let buf = Buffer.from(file)
    let offset = buf.readUInt32LE(0)
    if (new StringDecoder().write(buf.slice(4, 8)) !== 'PFS ') {
      throw new Error('File is not S3D')
    }
    let fileList = []
    let count = buf.readUInt32LE(offset)
    console.log(`File count ${count}`)
    let cursor = 0
    let directory = null
    for (let i = 0; i < count; i++) {
      cursor = offset + 4 + (i * 12)
      let crc = buf.readUInt32LE(cursor)
      let foff = buf.readUInt32LE(cursor + 4)
      let size = buf.readUInt32LE(cursor + 8)
      let data = Buffer.alloc(size)
      let readCursor = foff
      let writeCursor = 0
      while (writeCursor < size) {
        let deflen = buf.readUInt32LE(readCursor)
        readCursor += 4
        let inflen = buf.readUInt32LE(readCursor)
        readCursor += 4
        let inflated = Buffer.from(zlib.inflate(buf.slice(readCursor, readCursor + deflen)))
        if (inflated.length !== inflen) throw new Error("ZLib Decompression failed")
        inflated.copy(data, writeCursor)
        readCursor += deflen
        writeCursor += inflen
      }
      if (crc === 0x61580AC9) {
        directory = data
      } else {
        fileList.push({foff, data})
      }
    }
    fileList.sort((a, b) => {
      return a.foff - b.foff
    })

    let dirbuf = Buffer.from(directory)
    let dirCursor = 0
    let dirlen = dirbuf.readUInt32LE(dirCursor)
    dirCursor += 4
    if ( dirlen !== fileList.length ) {
      throw new Error("S3D Corrupt, directory does not match file length")
    }
    let files = {}
    for (let f of fileList) {
      let fileNameLength = dirbuf.readUInt32LE(dirCursor)
      dirCursor += 4
      let fileName = new StringDecoder().write(dirbuf.slice(dirCursor, dirCursor + fileNameLength)).trim()
      fileName = fileName.slice(0, fileName.length - 1)
      dirCursor += fileNameLength
      files[fileName] = f.data
    }
    console.log("Successfully Loaded")
    console.log("Loading WLDs")
    let wld = files[`${fileName.split('.')[0]}.wld`]
    cb({
      wld: loadWld(wld),
      ...("objects.wld" in files ? {obj: loadWld(files["objects.wld"])} : {}),
      s3d: {directory, files}
    })
  })
}

function loadWld(wld) {
  console.log("Loading WLD")
  let fragment = {}
  let unknownFragments = {}
  let buf = Buffer.from(wld)
  let magic = buf.readUInt32LE(0)
  let version = buf.readUInt32LE(4)
  let fragmentCount = buf.readUInt32LE(8)
  let bspRegionCount = buf.readUInt32LE(12)
  let unknown = buf.readUInt32LE(16)
  let stringHashSize = buf.readUInt32LE(20)
  let unknown2 = buf.readUInt32LE(24)
  console.log(`Found fragment count of ${fragmentCount}`)
  console.log(`Loading string hash of size ${stringHashSize} bytes`)
  let stringHash = buf.slice(28, 28 + stringHashSize)
  let decodedStringHash = Buffer.alloc(stringHashSize)
  let hashKey = [0x95, 0x3A, 0xC5, 0x2A, 0x95, 0x7A, 0x95, 0x6A]
  for (let i = 0; i < stringHashSize; i++) {
    let char = stringHash[i]
    let decodedChar = char ^ hashKey[i % 8]
    decodedStringHash[i] = decodedChar
  }
  let stringTable = new StringDecoder().write(decodedStringHash)
  let fragIndex = 0
  let fragCursor = 28 + stringHashSize
  for (let i = 0; i < fragmentCount; i++) {
    let fragSize = buf.readUInt32LE(fragCursor)
    let fragType = buf.readUInt32LE(fragCursor + 4)
    let nameRef = buf.readInt32LE(fragCursor + 8)
    let fragName = stringTable.substr(-nameRef, stringTable.indexOf('\0', -nameRef)+nameRef)
    let bodyCursor = fragCursor + 12
    switch(fragType) {
      case 0x03: // Texture Path
        let files = []
        let fileCount = buf.readUInt32LE(bodyCursor) + 1
        bodyCursor += 4
        for (let i = 0; i < fileCount; i++) {
          let nameLength = buf.readUInt16LE(bodyCursor)
          bodyCursor += 2
          let encodedName = buf.slice(bodyCursor, bodyCursor + nameLength)
          let fileName = Buffer.alloc(nameLength)
          for (let i = 0; i < nameLength; i++) {
            let char = encodedName[i]
            let decodedChar = char ^ hashKey[i % 8]
            fileName[i] = decodedChar
          }
          let name = new StringDecoder().write(fileName)
          files.push(name.slice(0, name.length - 1))
          fragment[fragIndex] = {type: "TexturePath", typeCode: fragType, name: fragName, files}
          bodyCursor += nameLength
        }
        break
      case 0x04: // Texture Info
        let textureInfoFlags = buf.readUInt32LE(bodyCursor)
        let unknownFlag = (textureInfoFlags & 4) == 4 ? true : false
        let animatedFlag = (textureInfoFlags & 8) == 8 ? true : false
        bodyCursor += 4
        let referenceCount = buf.readUInt32LE(bodyCursor)
        bodyCursor += 4
        let unknownField = buf.readUInt32LE(bodyCursor)
        if (unknownFlag) {
          bodyCursor += 4
        }
        let frameTime = buf.readUInt32LE(bodyCursor)
        if (animatedFlag) {
          bodyCursor += 4
        }
        let texturePaths = []
        for (let i = 0; i < referenceCount; i++) {
          texturePaths.push(buf.readInt32LE(bodyCursor) - 1)
          bodyCursor += 4
        }
        fragment[fragIndex] = {type: "TextureInfo", typeCode: fragType, name: fragName, animatedFlag, ...(animatedFlag ? {frameTime} : {}), texturePaths}
        break
      case 0x05: // Texture Info Reference
        fragment[fragIndex] = {type: "TextureInfoRef", typeCode: fragType, name: fragName, textureInfo: buf.readUInt32LE(bodyCursor) - 1}
        break
      case 0x09: // Camera Ref
        fragment[fragIndex] = {type: "CameraRef", typeCode: fragType, name: fragName, camera: buf.readUInt32LE(bodyCursor) - 1}
        break
      case 0x14: // Static or Animated Model Ref/Player Info
        let staticModelFlags = buf.readUInt32LE(bodyCursor)
        let staticModelParam1Exists = (staticModelFlags & 1) == 1 ? true : false
        let staticModelParam2Exists = (staticModelFlags & 2) == 2 ? true : false
        bodyCursor += 4
        let staticModelFragment1 = buf.readInt32LE(bodyCursor)
        bodyCursor += 4
        let staticModelSize1 = buf.readUInt32LE(bodyCursor)
        bodyCursor += 4
        let staticModelSize2 = buf.readUInt32LE(bodyCursor)
        bodyCursor += 4
        bodyCursor += 4 // Skip Fragment2
        if (staticModelParam1Exists) bodyCursor += 4 // Skip Params1
        if (staticModelParam2Exists) bodyCursor += 4 * 7 // Skip Params2
        for (let i = 0; i < staticModelSize1; i++) { // Skip Entry1
          let size = buf.readUInt32LE(bodyCursor)
          bodyCursor += 4
          bodyCursor += 8 * size
        }
        let staticModelFragment3s = []
        for (let i = 0; i < staticModelSize2; i++) {
          staticModelFragment3s.push(buf.readUInt32LE(bodyCursor) - 1)
          bodyCursor += 4
        }
        fragment[fragIndex] = {type: "StaticModelRef", typeCode: fragType, name: fragName, meshReferences: staticModelFragment3s}
        break
      case 0x15: // PlaceableObject Location
        let olName = buf.readInt32LE(bodyCursor)
        bodyCursor += 4
        let olFlag = buf.readUInt32LE(bodyCursor)
        if ( olFlag == 0x2E ) break
        let olRef = stringTable.substr(-olName, stringTable.indexOf('\0', -olName)+olName)
        bodyCursor += 4
        bodyCursor += 4 // Skip Fragment1
        let olX = buf.readFloatLE(bodyCursor)
        bodyCursor += 4
        let olY = buf.readFloatLE(bodyCursor)
        bodyCursor += 4
        let olZ = buf.readFloatLE(bodyCursor)
        bodyCursor += 4
        let olRotZ = buf.readFloatLE(bodyCursor)
        bodyCursor += 4
        let olRotY = buf.readFloatLE(bodyCursor)
        bodyCursor += 4
        let olRotX = buf.readFloatLE(bodyCursor)
        bodyCursor += 4
        bodyCursor += 4 // Skip Params1
        let olScaleY = buf.readFloatLE(bodyCursor)
        bodyCursor += 4
        let olScaleX = buf.readFloatLE(bodyCursor)
        bodyCursor += 4
        let vertexColorRef = buf.readUInt32LE(bodyCursor) - 1
        fragment[fragIndex] = {type: "ObjectLocation", typeCode: fragType, name: fragName, ref: olRef, x: olX, y: olY, z: olZ, rotX: olRotX, rotY: olRotY, rotZ: olRotZ, scaleX: olScaleX, scaleY: olScaleY, vertexColorRef}
        break
      case 0x2C: // Mesh Alternate
        console.log("MESH 2C FOUND")
        fragment[fragIndex] = {type: "MeshAlt", typeCode: fragType, name: fragName}
        break
      case 0x2D: // Mesh Reference
        fragment[fragIndex] = {type: "MeshRef", typeCode: fragType, name: fragName, mesh: buf.readUInt32LE(bodyCursor) - 1}
        break
      case 0x30: // Texture
        let existenceFlags = buf.readUInt32LE(bodyCursor)
        bodyCursor += 4
        let pairFieldExists = (existenceFlags & 1) === 1
        let textureFlags = buf.readUInt32LE(bodyCursor)
        bodyCursor += 4 + 12
        let transparent = !((textureFlags & 1) === 1)
        let masked = (textureFlags & 2) === 2
        if (pairFieldExists) {
          bodyCursor += 0
        }
        let textureInfoRef = buf.readUInt32LE(bodyCursor) - 1
        fragment[fragIndex] = {type: "Texture", typeCode: fragType, name: fragName, transparent, masked, textureInfoRef}
        break
      case 0x31: // TextureList
        bodyCursor += 4
        let refCount = buf.readUInt32LE(bodyCursor)
        bodyCursor += 4
        let texture = []
        for (let i = 0; i < refCount; i++) {
          texture.push(buf.readInt32LE(bodyCursor) - 1)
          bodyCursor += 4
        }
        fragment[fragIndex] = {type: "TextureList", typeCode: fragType, name: fragName, textureInfoRefsList: texture}
        break
      case 0x36: // Mesh
        let meshFlags = buf.readUInt32LE(bodyCursor)
        bodyCursor += 4
        let meshType = meshFlags === 0x00018003 ? 'zone' : 'object'
        let textureList = buf.readUInt32LE(bodyCursor) - 1
        bodyCursor += 4
        let animatedVertices = buf.readUInt32LE(bodyCursor)
        bodyCursor += 12
        let centerX = buf.readFloatLE(bodyCursor)
        bodyCursor += 4
        let centerY = buf.readFloatLE(bodyCursor)
        bodyCursor += 4
        let centerZ = buf.readFloatLE(bodyCursor)
        bodyCursor += 44
        let vertexCount = buf.readUInt16LE(bodyCursor)
        bodyCursor += 2
        let texCoordsCount = buf.readUInt16LE(bodyCursor)
        bodyCursor += 2
        let normalsCount = buf.readUInt16LE(bodyCursor)
        bodyCursor += 2
        let colorCount = buf.readUInt16LE(bodyCursor)
        bodyCursor += 2
        let polygonsCount = buf.readUInt16LE(bodyCursor)
        bodyCursor += 2
        let vertexPieceCount = buf.readUInt16LE(bodyCursor)
        bodyCursor += 2
        let polygonTexCount = buf.readUInt16LE(bodyCursor)
        bodyCursor += 2
        let vertexTexCount = buf.readUInt16LE(bodyCursor)
        bodyCursor += 2
        let size9 = buf.readUInt16LE(bodyCursor)
        bodyCursor += 2
        let scale = buf.readUInt16LE(bodyCursor)
        bodyCursor += 2
        let vertices = []
        for (let i = 0; i < vertexCount; i++) {
          let vertexX = buf.readInt16LE(bodyCursor)
          bodyCursor += 2
          let vertexY = buf.readInt16LE(bodyCursor)
          bodyCursor += 2
          let vertexZ = buf.readInt16LE(bodyCursor)
          bodyCursor += 2
          let vertex = {x: vertexX, y: vertexY, z: vertexZ}
          vertices.push(vertex)
        }
        let textureCoords = []
        for (let i = 0; i < texCoordsCount; i++) {
          let textureCoordTX = buf.readInt16LE(bodyCursor)
          bodyCursor += 2
          let textureCoordTZ = buf.readInt16LE(bodyCursor)
          bodyCursor += 2
          let textureCoord = {x: textureCoordTX, z: textureCoordTZ}
          textureCoords.push(textureCoord)
        }
        let vertexNormals = []
        for (let i = 0; i < normalsCount; i++) {
          let normalX = buf.readInt8(bodyCursor) / 127.0
          bodyCursor += 1
          let normalY = buf.readInt8(bodyCursor) / 127.0
          bodyCursor += 1
          let normalZ = buf.readInt8(bodyCursor) / 127.0
          bodyCursor += 1
          let normal = {x: normalX, y: normalY, z: normalZ}
          vertexNormals.push(normal)
        }
        let vertexColors = []
        for (let i = 0; i < colorCount; i++) {
          let vertexColor = buf.readUInt32LE(bodyCursor)
          bodyCursor += 4
          vertexColors.push(vertexColor)
        }
        let polygons = []
        for (let i = 0; i < polygonsCount; i++) {
          let polygonFlag = buf.readUInt16LE(bodyCursor)
          bodyCursor += 2
          let vertex1 = buf.readUInt16LE(bodyCursor)
          bodyCursor += 2
          let vertex2 = buf.readUInt16LE(bodyCursor)
          bodyCursor += 2
          let vertex3 = buf.readUInt16LE(bodyCursor)
          bodyCursor += 2
          polygons.push({polygonFlag, vertex1, vertex2, vertex3})
        }
        let vertexPieces = []
        for (let i = 0; i < vertexPieceCount; i++) {
          let vertexCount = buf.readUInt16LE(bodyCursor)
          bodyCursor += 2
          let pieceIndex = buf.readUInt16LE(bodyCursor)
          bodyCursor += 2
          vertexPieces.push({vertexCount, pieceIndex})
        }
        let polygonTextures = []
        for (let i = 0; i < polygonTexCount; i++) {
          let polygonCount = buf.readUInt16LE(bodyCursor)
          bodyCursor += 2
          let textureIndex = buf.readUInt16LE(bodyCursor)
          bodyCursor += 2
          polygonTextures.push({polygonCount, textureIndex})
        }
        let vertexTextures = []
        for (let i = 0; i < vertexTexCount; i++) {
          let vertexCount = buf.readUInt16LE(bodyCursor)
          bodyCursor += 2
          let textureIndex = buf.readUInt16LE(bodyCursor)
          bodyCursor += 2
          vertexTextures.push({vertexCount, textureIndex})
        }
        fragment[fragIndex] = {type: "Mesh", typeCode: fragType, name: fragName,
          meshType,
          textureList,
          animatedVertices,
          centerX, centerY, centerZ,
          scale,
          vertexCount,
          vertices,
          texCoordsCount,
          textureCoords,
          normalsCount,
          vertexNormals,
          colorCount,
          vertexColors,
          polygonsCount,
          polygons,
          vertexPieceCount,
          vertexPieces,
          polygonTexCount,
          polygonTextures,
          vertexTexCount,
          vertexTextures
        }
        break
      case 0x08: // Camera
      case 0x16: // Zone Unknown
      case 0x1B: // Light Source
      case 0x1C: // Light Source Ref
      case 0x21: // BSP Tree
      case 0x22: // BSP Region
      case 0x29: // Region Flag
      case 0x2A: // Ambient Light
      case 0x32: // Vertex Color
      case 0x33: // Vertex Color Ref
      case 0x35: // First Fragment -- Purpose Unknown
      default:
        if ( unknownFragments[fragType] ) {
          unknownFragments[fragType]++
        } else {
          unknownFragments[fragType] = 1
        }
    }
    fragCursor += fragSize + 8
    fragIndex += 1
  }
  console.log(`Encountered unknown fragments:`)
  for (let fragType in unknownFragments) {
    console.log(`0x${parseInt(fragType).toString(16)} - ${unknownFragments[fragType]} count`)
  }
  console.log("Done loading all fragments")
  return fragment
}
