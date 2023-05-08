const b4a = require('b4a')

const BUFFER = {}

BUFFER.preencode = function (state, buf) {
  let i = 0
  let extra = 2

  while ((i = b4a.indexOf(buf, 0x00, i)) > -1) {
    i++
    extra++
  }

  state.end += buf.byteLength + extra
}

BUFFER.encode = function (state, buf) {
  let prev = 0
  let i = 0

  while ((i = b4a.indexOf(buf, 0x00, i)) > -1) {
    const slice = buf.subarray(prev, ++i)

    state.buffer.set(slice, state.start)
    state.start += slice.byteLength
    state.buffer[state.start++] = 0x01
    prev = i
  }

  const slice = buf.subarray(prev)

  state.buffer.set(slice, state.start)
  state.start += slice.byteLength

  state.buffer[state.start++] = 0x00
  state.buffer[state.start++] = 0x02
}

BUFFER.decode = function (state) {
  let escaped = null

  let prev = state.start
  let i = state.start

  while ((i = b4a.indexOf(state.buffer, 0x00, i)) > -1) {
    const next = ++i < state.end ? state.buffer[i] : 0x00

    i++

    if (next === 0x01) {
      if (escaped === null) escaped = []
      escaped.push(state.buffer.subarray(prev, i - 1))
      prev = i
      continue
    }

    if (next === 0x02) {
      break
    }

    throw new Error('Unknown value in terminator')
  }

  if (i === -1) {
    throw new Error('No terminator found')
  }

  state.start = i
  const last = state.buffer.subarray(prev, i - 2)
  if (escaped === null) return last

  escaped.push(last)
  return b4a.concat(escaped)
}

// TODO: can be optimised a lot

const STRING = {}

STRING.preencode = function (state, str) {
  BUFFER.preencode(state, b4a.from(str))
}

STRING.encode = function (state, str) {
  BUFFER.encode(state, b4a.from(str))
}

STRING.decode = function (state, str) {
  return b4a.toString(BUFFER.decode(state))
}

const UINT = {}

UINT.preencode = function (state, n) {
  state.end += n <= 0xfc ? 1 : n <= 0xffff ? 3 : n <= 0xffffffff ? 5 : 9
}

UINT.encode = function (state, n) {
  if (n <= 0xfc) {
    state.buffer[state.start++] = n
    return
  }

  if (n <= 0xffff) {
    state.buffer[state.start++] = 0xfd
    state.buffer[state.start++] = n >>> 8
    state.buffer[state.start++] = n
    return
  }

  if (n <= 0xffffffff) {
    state.buffer[state.start++] = 0xfe
    encodeUint32(state, n)
    return
  }

  state.buffer[state.start++] = 0xff

  const r = Math.floor(n / 0x100000000)
  encodeUint32(state, r)
  encodeUint32(state, n)
}

UINT.decode = function (state) {
  if (state.start >= state.end) throw new Error('Out of bounds')

  const a = state.buffer[state.start++]

  if (a <= 0xfc) return a

  if (a === 0xfd) {
    if (state.end - state.start < 2) throw new Error('Out of bounds')
    return (
      state.buffer[state.start++] * 0x100 +
      state.buffer[state.start++]
    )
  }

  if (a === 0xfe) {
    return decodeUint32(state)
  }

  return (
    decodeUint32(state) * 0x100000000 +
    decodeUint32(state)
  )
}

module.exports = class IndexEncoder {
  constructor (encodings) {
    this.encodings = encodings
  }

  static BUFFER = BUFFER
  static STRING = STRING
  static UINT = UINT

  encode (keys) {
    const state = { start: 0, end: 0, buffer: null }

    for (let i = 0; i < keys.length; i++) {
      this.encodings[i].preencode(state, keys[i])
    }

    state.buffer = b4a.allocUnsafe(state.end)

    for (let i = 0; i < keys.length; i++) {
      this.encodings[i].encode(state, keys[i])
    }

    return state.buffer
  }

  decode (buffer) {
    const state = { start: 0, end: buffer.byteLength, buffer }
    const result = []

    for (const enc of this.encodings) {
      const key = state.start < state.end ? enc.decode(state) : (enc === UINT ? 0 : null)
      result.push(key)
    }

    return result
  }
}

function encodeUint32 (state, n) {
  state.buffer[state.start++] = n >>> 24
  state.buffer[state.start++] = n >>> 16
  state.buffer[state.start++] = n >>> 8
  state.buffer[state.start++] = n
}

function decodeUint32 (state, n) {
  if (state.end - state.start < 4) throw new Error('Out of bounds')
  return (
    state.buffer[state.start++] * 0x1000000 +
    state.buffer[state.start++] * 0x10000 +
    state.buffer[state.start++] * 0x100 +
    state.buffer[state.start++]
  )
}
