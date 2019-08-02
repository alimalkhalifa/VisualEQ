export default class Helper {
  static getZOffset(race) {
    let offset = 0
    if (race > 12) {
      switch (race) {
        case 106: // ELVEN GUARD
          offset = 0
          break
        case 436: // BASILISK
          offset = 0.577
          break
        case 430: // DRAKE
          offset = 0.5
          break
        case 432: // DRAKE
          offset = 1.9
          break
        case 435: // DRAGON
          offset = 0.93
          break
        case 450: // LAVA SPIDER
          offset = 0.938
          break
        case 479: // ALLIGATOR
          offset = 0.8
          break
        case 451: // LAVA SPIDER QUEEN
          offset = 0.816
          break
        case 437: // DRAGON
          offset = 0.527
          break
        case 439: // PUMA
          offset = 1.536
          break
        case 415: // RAT
          offset = 1.0
          break
        case 438: // DRAGON
          offset = 0.776
          break
        case 452: // DRAGON
          offset = 0.776
          break
        case 441: // SPIDER QUEEN
          offset = 0.816
          break
        case 440: // SPIDER
          offset = 0.938
          break
        case 468: // SNAKE
          offset = 1.0
          break
        case 459: // CORATHUS
          offset = 1.0
          break
        case 462: // DRACHNID COCOON
          offset = 1.5
          break
        case 530: // DRAGON
          offset = 1.2
          break
        case 549: // GOO
          offset = 0.5
          break
        case 548: // GOO
          offset = 0.5
          break
        case 547: // GOO
          offset = 0.5
          break
        case 604: // DRACOLICH
          offset = 1.2
          break
        case 653: // TELMIRA
          offset = 5.9
          break
        case 658: // MORELL THULE
          offset = 4.0
          break
        case 323: // ARMOR OF MARR
          offset = 5.0
          break
        case 663: // AMYGDALAN
          offset = 5.0
          break
        case 664: // SANDMAN
          offset = 4.0
          break
        case 703: // ALARAN SENTRY STONE
          offset = 9.0
          break
        case 668: // RABBIT
          offset = 5.0
          break
        case 669: // BLIND DREAMER
          offset = 7.0
          break
        case 687: // GORAL
          offset = 2.0
          break
        case 686: // SELYRAH
          offset = 2.0
          break
        default:
          offset = 3.125
      }
    }
    return offset
  }
}