const b4a = require('b4a')
const test = require('brittle')
const Hyperbee = require('hyperbee')
const Hypercore = require('hypercore')
const ram = require('random-access-memory')

const IndexEncoder = require('./')

test('basic', function (t) {
  const i = new IndexEncoder([
    IndexEncoder.UINT,
    IndexEncoder.STRING
  ])

  const data = [
    [0, 'a'],
    [0, 'b'],
    [0, 'c'],
    [1, 'a'],
    [2, 'a'],
    [300, 'c'],
    [400, 'c']
  ]

  const keys = data.map(d => i.encode(d))

  t.alike(sliceAndDecode(i, [], [], keys), data)
  t.alike(sliceAndDecode(i, [0], [0], keys), [[0, 'a'], [0, 'b'], [0, 'c']])
  t.alike(sliceAndDecode(i, [0, 'b'], [0], keys), [[0, 'b'], [0, 'c']])
  t.alike(sliceAndDecodeNonInclusive(i, [0, 'a'], [0, 'c'], keys), [[0, 'b']])
  t.alike(sliceAndDecode(i, [1], [1], keys), [[1, 'a']])
  t.alike(sliceAndDecode(i, [2], [], keys), [[2, 'a'], [300, 'c'], [400, 'c']])
})

test('basic prefix', function (t) {
  const i = new IndexEncoder([
    IndexEncoder.UINT,
    IndexEncoder.STRING
  ], { prefix: 4 })

  const buf = i.encode([])
  t.alike(buf, b4a.from([4]))

  const range = i.encodeRange({})
  t.alike(range.gte, b4a.from([4]))
  t.alike(range.lt, b4a.from([5]))
})

test('hyperbee bounded iteration', async function (t) {
  const keyEncoding = new IndexEncoder([
    IndexEncoder.UINT,
    IndexEncoder.STRING
  ])
  const bee = new Hyperbee(new Hypercore(ram), {
    keyEncoding,
    valueEncoding: 'utf-8'
  })

  await bee.put([1, 'a'], 'a')
  await bee.put([1, 'b'], 'b')
  await bee.put([2, 'aa'], 'aa')
  await bee.put([2, 'bb'], 'bb')
  await bee.put([3, 'aaa'], 'aaa')
  await bee.put([3, 'bbb'], 'bbb')

  const expectedKeys = [[2, 'aa'], [2, 'bb']]

  for await (const node of bee.createReadStream({ gt: [1], lt: [3] })) {
    t.alike(node.key, expectedKeys.shift())
  }
  t.is(expectedKeys.length, 0)
})

function sliceAndDecodeNonInclusive (i, gt, lt, data) {
  const r = i.encodeRange({ gt, lt })
  const all = []

  for (const key of data) {
    if (b4a.compare(r.gt, key) >= 0) continue
    if (b4a.compare(key, r.lt) >= 0) continue
    all.push(i.decode(key))
  }

  return all
}

function sliceAndDecode (i, gte, lte, data) {
  const r = i.encodeRange({ gte, lte })
  const all = []

  for (const key of data) {
    if (b4a.compare(r.gte, key) > 0) continue
    if (b4a.compare(key, r.lte) > 0) continue
    all.push(i.decode(key))
  }

  return all
}
