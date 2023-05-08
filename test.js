const b4a = require('b4a')
const test = require('brittle')
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
  t.alike(sliceAndDecode(i, [0, 'a'], [0], keys), [[0, 'b'], [0, 'c']])
  t.alike(sliceAndDecode(i, [0, 'a'], [0, 'c'], keys), [[0, 'b']])
  t.alike(sliceAndDecode(i, [1], [1], keys), [[1, 'a']])
  t.alike(sliceAndDecode(i, [2], [], keys), [[2, 'a'], [300, 'c'], [400, 'c']])
})

function sliceAndDecode (i, gt, lt, data) {
  const r = i.range({ gt, lt })

  const all = []

  for (const key of data) {
    if (b4a.compare(r.gt, key) >= 0) continue
    if (b4a.compare(key, r.lt) >= 0) continue
    all.push(i.decode(key))
  }

  return all
}
