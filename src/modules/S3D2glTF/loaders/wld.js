const { StringDecoder } = require('string_decoder')
const {  parentPort } = require('worker_threads')

module.exports = function loadWld(wld) {
  //console.log("Loading WLD")
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
  //console.log(`Found fragment count of ${fragmentCount}`)
  //console.log(`Loading string hash of size ${stringHashSize} bytes`)
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
      case 0x06: // 2D object
        let object2DFlags = buf.readUInt32LE(bodyCursor)
        let object2DParam3Exists = (object2DFlags & (1 << 0)) === (1 << 0)
        let object2DParam4Exists = (object2DFlags & (1 << 1)) === (1 << 1)
        let object2DParam5Exists = (object2DFlags & (1 << 2)) === (1 << 2)
        let object2DParam6Exists = (object2DFlags & (1 << 3)) === (1 << 3)
        let object2DParam2Exists = (object2DFlags & (1 << 7)) === (1 << 7)
        bodyCursor += 4
        let object2DSubSize1 = buf.readUInt32LE(bodyCursor)
        bodyCursor += 4
        let object2DSize1 = buf.readUInt32LE(bodyCursor)
        bodyCursor += 4
        let object2DParams1_1 = buf.readUInt32LE(bodyCursor)
        bodyCursor += 4
        let object2DParams1_2 = buf.readUInt32LE(bodyCursor)
        bodyCursor += 4
        bodyCursor += 4 // Skip Fragment
        if (object2DParam2Exists) bodyCursor += 4 // Skip Params2
        if (object2DParam3Exists) bodyCursor += 12 // Skip Params3
        if (object2DParam4Exists) bodyCursor += 4 // Skip Params4
        if (object2DParam5Exists) bodyCursor += 4 // Skip Params5
        if (object2DParam6Exists) bodyCursor += 4 // Skip Params6
        let object2DTextureRefs = []
        for (let i = 0; i < object2DSize1; i++) {
          let material = []
          bodyCursor += 4 // Skip unneeded data
          let object2DData6Size = buf.readUInt32LE(bodyCursor) & 0x7FFFFFFF
          bodyCursor += 4
          for (let s = 0; s < object2DData6Size; s++) {
            let texture = []
            bodyCursor += 4 // Skip unneeded data
            for (let j = 0; j < object2DSubSize1; j++) {
              texture.push(buf.readUInt32LE(bodyCursor))
              bodyCursor += 4
            }
            material.push(texture)
          }
          object2DTextureRefs.push(material)
        }
        fragment[fragIndex] = {type: "Object2D", typeCode: fragType, name: fragName, textures: object2DTextureRefs}
        break
      case 0x07: // 2D object Ref
        fragment[fragIndex] = {type: "Object2DRef", typeCode: fragType, name: fragName, Object2D: buf.readUInt32LE(bodyCursor) - 1}
        break
      case 0x09: // Camera Ref
        fragment[fragIndex] = {type: "CameraRef", typeCode: fragType, name: fragName, camera: buf.readUInt32LE(bodyCursor) - 1}
        break
      case 0x10: // Skeleton Track
        let skeletonTrackFlags = buf.readUInt32LE(bodyCursor)
        let skeletonTrackParams1Exists = (skeletonTrackFlags & 1) === 1
        let skeletonTrackParams2Exists = (skeletonTrackFlags & 2) === 2
        let skeletonTrackSize2Fragment3Data3Exists = (skeletonTrackFlags & (2 << 9)) === (2 << 9)
        bodyCursor += 4
        let skeletonTrackSize1 = buf.readUInt32LE(bodyCursor)
        bodyCursor += 4
        let skeletonTrackFragment = buf.readUInt32LE(bodyCursor)
        bodyCursor += 4
        if (skeletonTrackParams1Exists) bodyCursor += 12 // Skip Params1
        if (skeletonTrackParams2Exists) bodyCursor += 4 // Skip Params2
        let skeletonTrackEntries = []
        for (let i = 0; i < skeletonTrackSize1; i++) {
          let Entry1 = {}
          Entry1.NameRef = buf.readInt32LE(bodyCursor)
          Entry1.Name = stringTable.substr(-Entry1.NameRef, stringTable.indexOf('\0', -Entry1.NameRef)+Entry1.NameRef)
          bodyCursor += 4
          Entry1.Flags = buf.readUInt32LE(bodyCursor)
          bodyCursor += 4
          Entry1.Fragment1 = buf.readUInt32LE(bodyCursor) - 1
          bodyCursor += 4
          Entry1.Fragment2 = buf.readUInt32LE(bodyCursor)
          bodyCursor += 4
          Entry1.Size = buf.readUInt32LE(bodyCursor)
          bodyCursor += 4
          Entry1.Data = []
          for (let j = 0; j < Entry1.Size; j++) {
            Entry1.Data.push(buf.readUInt32LE(bodyCursor))
            bodyCursor += 4
          }
          skeletonTrackEntries.push(Entry1)
        }
        let skeletonTrackSize2 = 0
        let skeletonTrackFragment3 = []
        let skeletonTrackData3 = []
        if (skeletonTrackSize2Fragment3Data3Exists) {
          skeletonTrackSize2 = buf.readUInt32LE(bodyCursor)
          bodyCursor += 4
        }
        for (let i = 0; i < skeletonTrackSize2; i++) { // if skeletonTrackSize2Fragment3Data3Exists
          skeletonTrackFragment3.push(buf.readUInt32LE(bodyCursor))
          bodyCursor += 4
        }
        for (let i = 0; i < skeletonTrackSize2; i++) { // if skeletonTrackSize2Fragment3Data3Exists
          skeletonTrackData3.push(buf.readUInt32LE(bodyCursor))
          bodyCursor += 4
        }
        fragment[fragIndex] = {type: "SkeletonTrack", typeCode: fragType, name: fragName,
          entriesCount: skeletonTrackSize1,
          polygonAnimationRef: skeletonTrackFragment,
          entries: skeletonTrackEntries,
          meshRefsCount: skeletonTrackSize2,
          meshRefs: skeletonTrackFragment3,
          data3: skeletonTrackData3
        }
        break
      case 0x11: // Skeleton Track Set Reference
        fragment[fragIndex] = {type: "SkeletonTrackRef", typeCode: fragType, name: fragName, skeletonTrack: buf.readUInt32LE(bodyCursor) - 1}
        break
      case 0x12: // Skeleton Piece Track
        let skeletonPieceTrackFlags = buf.readUInt32LE(bodyCursor)
        bodyCursor += 4
        let skeletonPieceTrackSize = buf.readUInt32LE(bodyCursor)
        bodyCursor += 4
        let skeletonPieceRotateDenominator = []
        let skeletonPieceRotateXNumerator = []
        let skeletonPieceRotateYNumerator = []
        let skeletonPieceRotateZNumerator = []
        let skeletonPieceShiftXNumerator = []
        let skeletonPieceShiftYNumerator = []
        let skeletonPieceShiftZNumerator = []
        let skeletonPieceShiftDenominator = []
        for (let i = 0; i < skeletonPieceTrackSize; i++) {
          skeletonPieceRotateDenominator.push(buf.readInt16LE(bodyCursor))
          bodyCursor += 2
          skeletonPieceRotateXNumerator.push(buf.readInt16LE(bodyCursor))
          bodyCursor += 2
          skeletonPieceRotateYNumerator.push(buf.readInt16LE(bodyCursor))
          bodyCursor += 2
          skeletonPieceRotateZNumerator.push(buf.readInt16LE(bodyCursor))
          bodyCursor += 2
          skeletonPieceShiftXNumerator.push(buf.readInt16LE(bodyCursor))
          bodyCursor += 2
          skeletonPieceShiftYNumerator.push(buf.readInt16LE(bodyCursor))
          bodyCursor += 2
          skeletonPieceShiftZNumerator.push(buf.readInt16LE(bodyCursor))
          bodyCursor += 2
          skeletonPieceShiftDenominator.push(buf.readInt16LE(bodyCursor))
          bodyCursor += 2
        }
        fragment[fragIndex] = {type: "SkeletonPieceTrack", typeCode: fragType, name: fragName,
          size: skeletonPieceTrackSize,
          rotateDenominator: skeletonPieceRotateDenominator,
          rotateX: skeletonPieceRotateXNumerator,
          rotateY: skeletonPieceRotateYNumerator,
          rotateZ: skeletonPieceRotateZNumerator,
          shiftDenominator: skeletonPieceShiftDenominator,
          shiftX: skeletonPieceShiftXNumerator,
          shiftY: skeletonPieceShiftYNumerator,
          shiftZ: skeletonPieceShiftZNumerator
        }
        break
      case 0x13: // Skeleton Piece Track Ref
        fragment[fragIndex] = {type: "SkeletonPieceTrackRef", typeCode: fragType, name: fragName, skeletonPieceTrack: buf.readUInt32LE(bodyCursor) - 1}
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
      case 0x26: // ItemParticle
        fragment[fragIndex] = {type: "ItemParticle", typeCode: fragType, name: fragName}
        break
      case 0x27: // ItemParticleRef
        fragment[fragIndex] = {type: "ItemParticleRef", typeCode: fragType, name: fragName, ref: buf.readUInt32LE(bodyCursor) - 1}
        break
      case 0x2C: { // Mesh Alternate
        fragment[fragIndex] = {type: "MeshAlt", typeCode: fragType, name: fragName}
        break
      }
      case 0x2D: // Mesh Reference
        fragment[fragIndex] = {type: "MeshRef", typeCode: fragType, name: fragName, mesh: buf.readUInt32LE(bodyCursor) - 1}
        break
      case 0x30: // Texture
        let existenceFlags = buf.readUInt32LE(bodyCursor)
        bodyCursor += 4
        let pairFieldExists = (existenceFlags & 1) === 1
        let textureFlags = buf.readUInt32LE(bodyCursor)
        bodyCursor += 4 + 12
        let notTransparent = (textureFlags & 1) === 1
        let masked = (textureFlags & 2) === 2
        let semitransparentNoMask = (textureFlags & 4) === 4
        let semitransparentMask = (textureFlags & 8) === 8
        let notSemitransparentMask = (textureFlags & 16) === 16
        let apparentlyNotTransparent = (textureFlags & (1 << 31)) === (1 << 31)
        if (pairFieldExists) {
          bodyCursor += 0
        }
        let textureInfoRef = buf.readUInt32LE(bodyCursor) - 1
        fragment[fragIndex] = {type: "Texture", typeCode: fragType, name: fragName,
          notTransparent,
          masked,
          semitransparentNoMask,
          semitransparentMask,
          notSemitransparentMask,
          apparentlyNotTransparent,
          textureInfoRef
        }
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
  /* console.log(`Encountered unknown fragments:`)
  for (let fragType in unknownFragments) {
    console.log(`0x${parseInt(fragType).toString(16)} - ${unknownFragments[fragType]} count`)
  }
  console.log("Done loading all fragments") */
  return fragment
}