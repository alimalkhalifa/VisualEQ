const fs = require('fs')
const path = require('path')
const { Worker } = require('worker_threads')
const extractTextures = require('./extractors/textures')
const loadS3D = require('./loaders/s3d')

let busy = false

const worker = new Worker(path.join(__dirname, 'worker.js'))
worker.on('message', message => {
  if (message.type === "log") console.log(message.message)
  else if (message.type === "file") {
    console.log(`Writing file ${message.out}`)
    fs.writeFile(message.out, message.data, err => {
      if (err) throw new Error(err)
    })
  }
  else if (message.type === "skip") {
    console.log(`Skipping ${message.name}`)
  }
  else if (message.type === "error") throw new Error(err)
  else if (message.type === "done") {
    console.log('Done')
    busy = false
  }
})
worker.on('error', (err) => {
  throw new Error(err)
})
worker.on('exit', (code) => {
  if (code !== 0)
    throw new Error(`Worker stopped with exit code ${code}`)
  else
    console.log('worker stopped cleanly')
})

function convertDir(dir, out) {
  try {
    fs.statSync(out)
  } catch(err) {
    console.log("out dir not found")
    fs.mkdirSync(out)
  }
  fs.readdir(dir, async (err, files) => {
    if (err) throw new Error(err)
    let s3dfiles = files.filter(val => val.indexOf('.s3d') !== -1)
    let queue = []
    for(let file of s3dfiles) {
      let s3dName = path.basename(file)
      s3dName = s3dName.indexOf('_') !== -1 ? s3dName.substr(0,s3dName.indexOf('_')) : s3dName.substr(0,s3dName.indexOf('.'))
      let type = 'zone'
      if (file.indexOf('_chr') !== -1 || file.indexOf('equip') !== -1) type = 'chr'
      else if (file.indexOf('_obj') !== -1) type = 'obj'
      let outdir
      if (type === "chr") {
        if (s3dName.indexOf('gequip') !== -1) {
          outdir = 'graphics/items'
        } else {
          outdir = 'graphics/characters'
        }
      } else {
        outdir = path.join(out,s3dName)
      }
      try {
        fs.statSync(outdir)
      } catch(err) {
        console.error('out dir not found')
        fs.mkdirSync(outdir)
      }
      let s3d = loadS3D(path.join(dir, file), file === 'gequip.s3d')
      await extractTextures(s3dName, type, s3d, outdir).then(value => {
        console.log('done extracting textures')
      })
      queue.push({s3dName, type, s3d, out: outdir})
    }
    processConvertQueue(queue, dir)
  })
}

function processConvertNewThread(s3dName, type, s3d, out) {
  worker.postMessage({type: "job", s3dName, s3dType: type, s3d, out})
  busy = true
}

function processConvertQueue(queue, dir) {
  if (queue.length === 0) {
    console.log('queue over')
    return
  }
  if (busy) {
    setTimeout(() => processConvertQueue(queue, dir), 50)
  } else {
    setTimeout(() => processConvertQueue(queue.slice(1), dir), 50)
    let file = queue[0]
    processConvertNewThread(file.s3dName, file.type, file.s3d, `${file.out}`) //convertS3D(`${dir}/${s3d}`, `${out}/${subout}`)
  }
}

module.exports = {
  convertDir
}