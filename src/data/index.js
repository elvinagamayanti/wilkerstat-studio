import KEC from './kec.json'
import DESA from './desa.json'
import SLS from './sls.json'

// ---- pengayaan properti (sama seperti prototipe) ----
KEC.features.forEach((f) => {
  f.properties.kdkec = f.properties.idkec.slice(-3)
})
DESA.features.forEach((f) => {
  const id = f.properties.iddesa
  f.properties.kdprov = id.slice(0, 2)
  f.properties.kdkab = id.slice(2, 4)
  f.properties.kdkec = id.slice(4, 7)
  f.properties.kddesa = id.slice(7, 10)
})

export const kecByIdkec = {}
KEC.features.forEach((f) => (kecByIdkec[f.properties.idkec] = f))

export const desaByIddesa = {}
DESA.features.forEach((f) => (desaByIddesa[f.properties.iddesa] = f))

export const stats = {
  kec: KEC.features.length,
  desa: DESA.features.length,
  sls: new Set(SLS.features.map((f) => f.properties.idsls)).size,
}

export function getSlsGroupsForDesa(iddesa) {
  const feats = SLS.features.filter((f) => f.properties.iddesa === iddesa)
  const map = {}
  feats.forEach((f) => {
    const id = f.properties.idsls
    if (!map[id]) map[id] = { idsls: id, nmsls: f.properties.nmsls, features: [] }
    map[id].features.push(f)
  })
  return Object.values(map).sort((a, b) => a.nmsls.localeCompare(b.nmsls))
}

export { KEC, DESA, SLS }
