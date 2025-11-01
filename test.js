const b4a = require('b4a')
const test = require('brittle')
const Hyperbee = require('hyperbee')
const Hypercore = require('hypercore')

const IndexEncoder = require('./')

test('a bunch of buffers', function (t) {
  const e = new IndexEncoder([
    IndexEncoder.BUFFER
  ])

  const all = []
  for (let i = 0; i < 65536; i++) {
    all.push({ i, buffer: e.encode([b4a.from([i >> 8, i & 255])]) })
  }

  all.sort((a, b) => b4a.compare(a.buffer, b.buffer))

  for (let i = 0; i < all.length; i++) {
    if (all[i].i !== i) {
      t.fail('sorted wrong:' + i)
      return
    }
  }

  t.pass('all sorted correctly')
})

test('some specific buffers', function (t) {
  const e = new IndexEncoder([
    IndexEncoder.BUFFER
  ])

  const all = [
    { i: 0, buffer: e.encode([b4a.from([0])]) },
    { i: 1, buffer: e.encode([b4a.from([0, 0])]) },
    { i: 2, buffer: e.encode([b4a.from([0, 0, 0])]) },
    { i: 3, buffer: e.encode([b4a.from([0, 1])]) },
    { i: 4, buffer: e.encode([b4a.from([1])]) },
    { i: 5, buffer: e.encode([b4a.from([1, 0])]) },
    { i: 6, buffer: e.encode([b4a.from([1, 0, 0])]) },
    { i: 7, buffer: e.encode([b4a.from([1, 1])]) },
    { i: 8, buffer: e.encode([b4a.from([2])]) }
  ]

  all.sort((a, b) => b4a.compare(a.buffer, b.buffer))

  for (let i = 0; i < all.length; i++) {
    if (all[i].i !== i) {
      t.fail('sorted wrong:' + i)
      return
    }
  }

  t.pass('all sorted correctly')
})

test('sliced', function (t) {
  const e = new IndexEncoder([
    IndexEncoder.STRING,
    IndexEncoder.UINT
  ])

  const all = [
    e.encode(['hello', 1]),
    e.encode(['hello', 2]),
    e.encode(['hallo', 1]),
    e.encode(['hollo', 1])
  ]

  all.sort(b4a.compare)

  t.alike(sliceAndDecode(e, ['hello'], ['hello'], all), [['hello', 1], ['hello', 2]])
})

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

test('bool indices', function (t) {
  const i = new IndexEncoder([
    IndexEncoder.BOOL,
    IndexEncoder.BOOL
  ])

  const data = [
    [true, true],
    [true, false],
    [false, true],
    [false, false]
  ]

  const keys = data.map(d => i.encode(d))

  t.alike(sliceAndDecode(i, [], [], keys), [[true, true], [true, false], [false, true], [false, false]])
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
  const bee = new Hyperbee(new Hypercore(await t.tmp()), {
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
