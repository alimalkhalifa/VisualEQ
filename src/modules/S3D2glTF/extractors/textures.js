const fs = require('fs')
const jimp = require('jimp')
const THREE = require('three')

module.exports = async function extractTextures(name, type, s3d, out) {
  console.log(`Extracting textures for ${name} - ${type}`)
  try {
    fs.statSync(`${out}/textures`)
  } catch(_) {
    console.error('out dir not found')
    fs.mkdirSync(`${out}/textures`)
  }
  for (let fileName in s3d.files) {
    if (fileName.indexOf('.bmp') !== -1) {
      await exportTexture(s3d.files[fileName], fileName, out)
    }
  }
}

function exportTexture(buf, fileName, out) {
  return new Promise((resolve, reject) => {
    if (buf.length > 0) {
      jimp.read(buf).then(bmp => {
        bmp.write(`${out}/textures/${fileName.substr(0, fileName.indexOf('.bmp'))}.png`, (err, alb) => {
          if (err) throw new Error(err)
          if (fileName.indexOf("fire") !== -1) {
            bmp.scan(0, 0, bmp.bitmap.width, bmp.bitmap.height, function(x, y, idx) {
              let hsl = {}
              hsl = new THREE.Color(this.bitmap.data[idx]/255, this.bitmap.data[idx+1]/255, this.bitmap.data[idx+2]/255).getHSL(hsl)
              let val = Math.pow(hsl.l, 1/4) * 255
              this.bitmap.data[idx+3] = val
            }, (err, newImg) => { 
              if (err) reject(new Error(err))
              newImg.write(`${out}/textures/${fileName.substr(0, fileName.indexOf('.bmp'))}_alpha.png`, (err) => {
                if (err) throw new Error(err)
                resolve()
              })
            })
          } else {
            let idxTrans = [-1, -1, -1, -1]
            let newTrans = true
            bmp.scan(0, 0, bmp.bitmap.width, bmp.bitmap.height, function(x, y, idx) {
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
                this.bitmap.data[idx+3] = 0
              } else {
                this.bitmap.data[idx+3] = 255
              }
            }, (err, newImg) => {
              if (err) reject(new Error(err))
              newImg.write(`${out}/textures/${fileName.substr(0, fileName.indexOf('.bmp'))}_alpha.png`, err => {
                if (err) throw new Error(err)
                resolve()
              })
            })
          }
        })
      }).catch(err => {
        console.log(err)
        fs.writeFileSync(`${out}/textures/${fileName.substr(0, fileName.indexOf('.bmp'))}.dds`, buf)
        resolve()
      })
    }
  })
}