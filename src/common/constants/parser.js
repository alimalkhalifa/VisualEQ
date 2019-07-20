const fs = require('fs')

raceConstants = {}
stringConstants = {
  raceIdent: {
    start: 'Race # ',
    end: ' '
  },
  maleIdent: 'Male = <b class="GenM">',
  femaleIdent: 'Female = <b class="GenF">',
  neutralIdent: 'Neutral = <b class="GenN">',
  NAEntry: 'N/A'
}

fs.readFile('./EQRaces.html', 'utf-8', (err, file) => {
  if (err) throw new Error(err)
  file = file.replace(/(<b class="Gen[MFN]"><\/b>)+/g, s => s.replace("<\/b>", ''))
  
  let records = {}
  let indexChunk = file.indexOf('<hr>')
  while (indexChunk !== -1) {
    // GET RACE NUMBER
    let raceIndex = file.indexOf(stringConstants.raceIdent.start, indexChunk) + stringConstants.raceIdent.start.length
    let raceEnd = file.indexOf(stringConstants.raceIdent.end, raceIndex)
    let race = file.substr(raceIndex, raceEnd - raceIndex)
    
    // GET MALE RACECODE
    let maleRaceIndex = file.indexOf(stringConstants.maleIdent, indexChunk) + stringConstants.maleIdent.length
    let male = file.substr(maleRaceIndex, 3)
    male = male === 'PPO' ? 'PPOINT' : male

    // GET MALE RACECODE
    let femaleRaceIndex = file.indexOf(stringConstants.femaleIdent, indexChunk) + stringConstants.femaleIdent.length
    let female = file.substr(femaleRaceIndex, 3)
    female = female === 'PPO' ? 'PPOINT' : female

    // GET MALE RACECODE
    let neutralRaceIndex = file.indexOf(stringConstants.neutralIdent, indexChunk) + stringConstants.neutralIdent.length
    let neutral = file.substr(neutralRaceIndex, 3)
    neutral = neutral === 'PPO' ? 'PPOINT' : neutral

    let record = {
      male,
      female,
      neutral
    }

    records[race] = record
    indexChunk = file.indexOf('<hr>', indexChunk+1)
  }
  fs.writeFile("raceCodeConstants.json", JSON.stringify(records, null, 2), (err) => {
    if (err) throw new Error(err)
  })
})
