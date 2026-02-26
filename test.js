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
  t.is(encodeDecode(123), 123, '123')
  t.is(encodeDecode(-123), -123, '-123')
  t.is(encodeDecode(400), 400, '400')
  t.is(encodeDecode(-400), -400, '-400')
  t.is(encodeDecode(Infinity), Infinity, 'Infinity')
  t.is(encodeDecode(-Infinity), -Infinity, '-Infinity')
  t.is(encodeDecode(0xf6), 0xf6, '0xf6 - max 1 byte')
  t.is(encodeDecode(0xf7), 0xf7, '0xf7 - max 1 byte +1')
  t.is(encodeDecode(0xff), 0xff, '+(2^8-1)')
  t.is(encodeDecode(-0xff), -0xff, '-(2^8-1)')
  t.is(encodeDecode(0x100), 0x100, '+2^8')
  t.is(encodeDecode(-0x100), -0x100, '-2^8')
  t.is(encodeDecode(0xffff), 0xffff, '+(2^16-1)')
  t.is(encodeDecode(-0xffff), -0xffff, '-(2^16-1)')
  t.is(encodeDecode(0x10000), 0x10000, '+2^16')
  t.is(encodeDecode(-0x10000), -0x10000, '-2^16')
  t.is(encodeDecode(0xffffffff), 0xffffffff, '+(2^32-1)')
  t.is(encodeDecode(-0xffffffff), -0xffffffff, '-(2^32-1)')
  t.is(encodeDecode(0x100000000), 0x100000000, '+2^32')
  t.is(encodeDecode(-0x100000000), -0x100000000, '-2^32')
  t.is(encodeDecode(11491632000000), 11491632000000, '2^32 < x < 2^32')
  t.is(encodeDecode(-11491632000000), -11491632000000, '-2^32 > x > -2^32')
  t.is(encodeDecode(Number.MAX_SAFE_INTEGER), Number.MAX_SAFE_INTEGER, 'MAX_SAFE_INTEGER')
  t.is(encodeDecode(Number.MIN_SAFE_INTEGER), Number.MIN_SAFE_INTEGER, 'MIN_SAFE_INTEGER')

  t.is(
    b4a.compare(encode(-100).buffer, encode(-1_000_000).buffer),
    1,
    'negative numbers order correctly'
  )

  t.is(
    b4a.compare(encode(100).buffer, encode(-1_000_000).buffer),
    1,
    'positive vs negative numbers order correctly'
  )

  t.exception(
    () => encode(Number.MIN_SAFE_INTEGER - 1),
    /Invalid number/,
    'throws on unsafe negative numbers'
  )
  t.exception(
    () => encode(Number.MAX_SAFE_INTEGER + 1),
    /Invalid number/,
    'throws on unsafe positive numbers'
  )
})

test('int', function (t) {
  const i = new IndexEncoder([IndexEncoder.INT, IndexEncoder.STRING])

  const data = [
    [0, 'a'],
    [-0, 'b'],
    [1, 'c'],
    [2, 'c'],
    [300, 'beep'],
    [-400, 'boop']
  ]

  const keys = data.map((d) => i.encode(d))

  t.alike(sliceAndDecode(i, [], [], keys), [
    [0, 'a'],
    [0, 'b'], // Converts -0 to 0
    [1, 'c'],
    [2, 'c'],
    [300, 'beep'],
    [-400, 'boop']
  ])
  t.alike(sliceAndDecodeNonInclusive(i, [0], [2], keys), [[1, 'c']])
  t.alike(sliceAndDecode(i, [], [-100], keys), [[-400, 'boop']])
  t.alike(
    sliceAndDecode(i, [300], [], keys),
    [[300, 'beep']],
    'ignores negative number of greater magnitude'
  )
})

test('date', function (t) {
  const i = new IndexEncoder([IndexEncoder.DATE])

  const data = [
    [new Date(0)],
    [new Date('1988-07-08')],
    [new Date('2016-09-08')],
    [new Date('2025-08-01')],
    [new Date('1605-11-05')]
  ]

  const keys = data.map((d) => i.encode(d))

  t.alike(sliceAndDecode(i, [], [], keys), data)
  t.alike(sliceAndDecodeNonInclusive(i, [new Date('1987')], [new Date('2026')], keys), [
    [new Date('1988-07-08')],
    [new Date('2016-09-08')],
    [new Date('2025-08-01')]
  ])
  t.alike(
    sliceAndDecode(i, [], [new Date('1979')], keys),
    [[new Date(0)], [new Date('1605-11-05')]],
    'range open start'
  )
  t.alike(
    sliceAndDecode(i, [new Date('2024')], [], keys),
    [[new Date('2025-08-01')]],
    'range open end'
  )
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
