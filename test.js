const b4a = require('b4a')
const test = require('brittle')
const Hyperbee = require('hyperbee')
const Hypercore = require('hypercore')

const IndexEncoder = require('./')

test('a bunch of buffers', function (t) {
  const e = new IndexEncoder([IndexEncoder.BUFFER])

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
  const e = new IndexEncoder([IndexEncoder.BUFFER])

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
  const e = new IndexEncoder([IndexEncoder.STRING, IndexEncoder.UINT])

  const all = [
    e.encode(['hello', 1]),
    e.encode(['hello', 2]),
    e.encode(['hallo', 1]),
    e.encode(['hollo', 1])
  ]

  all.sort(b4a.compare)

  t.alike(sliceAndDecode(e, ['hello'], ['hello'], all), [
    ['hello', 1],
    ['hello', 2]
  ])
})

test('basic', function (t) {
  const i = new IndexEncoder([IndexEncoder.UINT, IndexEncoder.STRING])

  const data = [
    [0, 'a'],
    [0, 'b'],
    [0, 'c'],
    [1, 'a'],
    [2, 'a'],
    [300, 'c'],
    [400, 'c']
  ]

  const keys = data.map((d) => i.encode(d))

  t.alike(sliceAndDecode(i, [], [], keys), data)
  t.alike(sliceAndDecode(i, [0], [0], keys), [
    [0, 'a'],
    [0, 'b'],
    [0, 'c']
  ])
  t.alike(sliceAndDecode(i, [0, 'b'], [0], keys), [
    [0, 'b'],
    [0, 'c']
  ])
  t.alike(sliceAndDecodeNonInclusive(i, [0, 'a'], [0, 'c'], keys), [[0, 'b']])
  t.alike(sliceAndDecode(i, [1], [1], keys), [[1, 'a']])
  t.alike(sliceAndDecode(i, [2], [], keys), [
    [2, 'a'],
    [300, 'c'],
    [400, 'c']
  ])
})

test('int - encoder', function (t) {
  const enc = IndexEncoder.INT

  const encode = (n) => {
    const state = { start: 0, end: 0, buffer: null }
    enc.preencode(state, n)
    state.buffer = b4a.allocUnsafe(state.end)
    enc.encode(state, n)
    return state
  }
  const encodeDecode = (n) => {
    const state = encode(n)
    state.start = 0
    return enc.decode(state)
  }

  t.is(encodeDecode(0), 0, 'zero')
  t.alike(encode(-0).buffer, encode(0).buffer, 'neg zero ignore')
  t.is(encodeDecode(-255), -255, '-255')
  t.is(encodeDecode(-400), -400, '-400')
  t.is(encodeDecode(-Infinity), -Infinity, '-Infinity')
  t.is(encodeDecode(-11491632000000), -11491632000000, '> 0x100000000')

  t.is(
    b4a.compare(
      encode(-100).buffer,
      encode(-1_000_000).buffer
    ),
    1,
    'negative numbers order correctly'
  )
})

test('int', function (t) {
  const i = new IndexEncoder([IndexEncoder.INT])

  const data = [
    [0],
    [-0],
    [1],
    [2],
    [300],
    [-400],
    [Infinity],
    [-Infinity]
  ]

  const keys = data.map((d) => i.encode(d))

  t.alike(sliceAndDecode(i, [], [], keys), [
    [0],
    [0], // Converts -0 to 0
    [1],
    [2],
    [300],
    [-400],
    [Infinity],
    [-Infinity]
  ])
  t.alike(sliceAndDecodeNonInclusive(i, [0], [2], keys), [[1]])
  t.alike(sliceAndDecode(i, [], [-100], keys), [
    [-400],
    [-Infinity]
  ])
  t.alike(sliceAndDecode(i, [300], [], keys), [
    [300],
    [Infinity]
  ], 'ignores negative number of greater magnitude')
})

test('bool indices', function (t) {
  const i = new IndexEncoder([IndexEncoder.BOOL, IndexEncoder.BOOL])

  const data = [
    [true, true],
    [true, false],
    [false, true],
    [false, false]
  ]

  const keys = data.map((d) => i.encode(d))

  t.alike(sliceAndDecode(i, [], [], keys), [
    [true, true],
    [true, false],
    [false, true],
    [false, false]
  ])
})

test('basic prefix', function (t) {
  const i = new IndexEncoder([IndexEncoder.UINT, IndexEncoder.STRING], {
    prefix: 4
  })

  const buf = i.encode([])
  t.alike(buf, b4a.from([4]))

  const range = i.encodeRange({})
  t.alike(range.gte, b4a.from([4]))
  t.alike(range.lt, b4a.from([5]))
})

test('hyperbee bounded iteration', async function (t) {
  const keyEncoding = new IndexEncoder([IndexEncoder.UINT, IndexEncoder.STRING])
  const bee = new Hyperbee(new Hypercore(await t.tmp()), {
    keyEncoding,
    valueEncoding: 'utf-8'
  })
  t.teardown(() => bee.close())

  await bee.put([1, 'a'], 'a')
  await bee.put([1, 'b'], 'b')
  await bee.put([2, 'aa'], 'aa')
  await bee.put([2, 'bb'], 'bb')
  await bee.put([3, 'aaa'], 'aaa')
  await bee.put([3, 'bbb'], 'bbb')

  const expectedKeys = [
    [2, 'aa'],
    [2, 'bb']
  ]

  for await (const node of bee.createReadStream({ gt: [1], lt: [3] })) {
    t.alike(node.key, expectedKeys.shift())
  }
  t.is(expectedKeys.length, 0)
})

function sliceAndDecodeNonInclusive(i, gt, lt, data) {
  const r = i.encodeRange({ gt, lt })
  const all = []

  for (const key of data) {
    if (b4a.compare(r.gt, key) >= 0) continue
    if (b4a.compare(key, r.lt) >= 0) continue
    all.push(i.decode(key))
  }

  return all
}

function sliceAndDecode(i, gte, lte, data) {
  const r = i.encodeRange({ gte, lte })
  const all = []

  for (const key of data) {
    if (b4a.compare(r.gte, key) > 0) continue
    if (b4a.compare(key, r.lte) > 0) continue
    all.push(i.decode(key))
  }

  return all
}
