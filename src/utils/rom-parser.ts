/**
 * NES ROM 文件解析工具
 * 解析 iNES 格式的文件头信息
 */

/** iNES 文件头结构 */
export interface INesHeader {
  /** 魔数，应为 'NES\x1A' */
  magic: string
  /** PRG ROM 大小（16KB 为单位） */
  prgRomSize: number
  /** CHR ROM 大小（8KB 为单位） */
  chrRomSize: number
  /** Flag 6 */
  flag6: number
  /** Flag 7 */
  flag7: number
  /** PRG RAM 大小（8KB 为单位） */
  prgRamSize: number
  /** TV 制式：0=NTSC, 1=PAL */
  tvSystem: number
  /** Mapper 编号 */
  mapper: number
  /** 镜像方式：'horizontal' | 'vertical' | 'four-screen' */
  mirroring: 'horizontal' | 'vertical' | 'four-screen'
  /** 是否包含电池备份 SRAM */
  hasBattery: boolean
  /** 是否有 Trainer（512字节训练数据） */
  hasTrainer: boolean
  /** 总 ROM 文件大小（字节） */
  fileSize: number
}

/** 从 Uint8Array 或 Buffer 解析 iNES 头 */
export function parseINesHeader(data: Uint8Array): INesHeader | null {
  if (data.length < 16) return null

  // 检查魔数 "NES\x1A"
  const magic = String.fromCharCode(data[0], data[1], data[2], data[3])
  if (magic !== 'NES\x1a') return null

  const prgRomSize = data[4] * 16384    // 16KB units
  const chrRomSize = data[5] * 8192     // 8KB units
  const flag6 = data[6]
  const flag7 = data[7]
  const prgRamSize = (data[8] || 1) * 8192  // 8KB units, default 1
  const tvSystem = data[9] & 1

  // Mapper = (flag7 & 0xF0) | (flag6 >> 4)
  const mapper = (flag7 & 0xf0) | (flag6 >> 4)

  // Mirroring
  const mirroringBit = flag6 & 1
  const fourScreen = (flag6 >> 3) & 1
  let mirroring: 'horizontal' | 'vertical' | 'four-screen'
  if (fourScreen) {
    mirroring = 'four-screen'
  } else if (mirroringBit) {
    mirroring = 'vertical'
  } else {
    mirroring = 'horizontal'
  }

  const hasBattery = ((flag6 >> 1) & 1) === 1
  const hasTrainer = ((flag6 >> 2) & 1) === 1

  return {
    magic,
    prgRomSize,
    chrRomSize,
    flag6,
    flag7,
    prgRamSize,
    tvSystem,
    mapper,
    mirroring,
    hasBattery,
    hasTrainer,
    fileSize: data.length
  }
}

/** 根据 Mapper 编号判断游戏兼容性和特性 */
export function getMapperInfo(mapper: number): string {
  const mapperNames: Record<number, string> = {
    0: 'NROM (基础)',
    1: 'MMC1 (塞尔达/银河战士)',
    2: 'UNROM (恶魔城/洛克人)',
    3: 'CNROM (冒险岛)',
    4: 'MMC3 (超级马力欧3/魂斗罗)',
    5: 'MMC5 (火纹/圣战系谱)',
    7: 'AxROM (大金刚/越野机车)',
    9: 'MMC2 (拳王泰森拳击)',
    10: 'MMC4 (火纹外传)',
    11: 'Color Dreams',
    66: 'GNROM (七龙珠)',
    71: 'Camerica (火/冰人)'
  }
  return mapperNames[mapper] || `Mapper #${mapper}`
}

/** 计算文件的简单 hash（用于匹配游戏数据库） */
export async function computeRomHash(data: Uint8Array): Promise<string> {
  // 跳过 iNES 头（16字节）和可能的 Trainer（512字节）
  const header = parseINesHeader(data)
  if (!header) return ''

  let offset = 16
  if (header.hasTrainer) offset += 512

  const romData = data.slice(offset)

  // 使用 Web Crypto API 计算 SHA-256
  try {
    const hashBuffer = await crypto.subtle.digest('SHA-256', romData)
    const hashArray = Array.from(new Uint8Array(hashBuffer))
    return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('')
  } catch {
    // 降级：简单 FNV-1a hash
    let hash = 0x811c9dc5
    for (let i = 0; i < romData.length; i++) {
      hash ^= romData[i]
      hash = (hash * 0x01000193) >>> 0
    }
    return hash.toString(16).padStart(8, '0')
  }
}
