const fs = require('fs')
const zlib = require('pako')
const { StringDecoder } = require('string_decoder')

module.exports = function(filePath, gequipHack) {
  try {
    let file = fs.readFileSync(filePath)
    let buf = Buffer.from(file)
    if (buf.length === 0) {
      return {
        wld: [],
        s3d: {}
      }
    }
    let offset = buf.readUInt32LE(0)
    if (new StringDecoder().write(buf.slice(4, 8)) !== 'PFS ') {
      throw new Error('File is not S3D')
    }
    let fileList = []
    let count = buf.readUInt32LE(offset)
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
    if ( (gequipHack && dirlen !== fileList.length + 1) || (!gequipHack && dirlen !== fileList.length )) {
      throw new Error("S3D Corrupt, directory does not match file length")
    }
    let files = {}
    for (let f of fileList) {
      let fileNameLength = dirbuf.readUInt32LE(dirCursor)
      dirCursor += 4
      let fileName = new StringDecoder().write(dirbuf.slice(dirCursor, dirCursor + fileNameLength)).trim()
      fileName = fileName.slice(0, fileName.length - 1)
      dirCursor += fileNameLength
      if (!gequipHack || fileName !== 'trace.dbg') {
        files[fileName] = f.data
      }
    }
    return {
      directory,
      files
    }
  } catch(err) {
    throw new Error(err)
  }
}
