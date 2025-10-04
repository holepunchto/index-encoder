# index-encoder

Encode multiple values into sorted keys

```
npm install index-encoder
```

## Usage

```js
const IndexEncoder = require('index-encoder')

const idx = new IndexEncoder([IndexEncoder.STRING, IndexEncoder.UINT])

const buf = idx.encode(['foo', 42])
console.log(idx.decode(buf)) // ['foo', 42]

// pass any compact encoding name to map it to the relevant encoding
const uintType = IndexEncoder.lookup('uint')
const bufferType = IndexEncoder.lookup('buffer')
const alsoBufferType = IndexEncoder.lookup('fixed32')
```

## API

#### `const idx = new IndexEncoder(encodings, { prefix = -1 })`

Create an index encoder using the array of `encodings`. The index encoder will produce a buffer encoding in the same order as `encodings`. A `prefix` can be defined to differentiate encoded buffers with the same `encodings`.

#### `const buf = idx.encode(keys)`

Encode the provided `keys` as a buffer. `keys` must be in the same order as the `encodings` when constructing the index encoder. `keys` can have less elements than the defined `encodings` to create a prefix buffer. When used with [`hyperbee`](https://github.com/holepunchto/hyperbee), this can be used to search for only a subset of the total keys.

#### `const range = idx.encodeRange(query)`

Encodes the `query` object values into their buffer equivalent values. Useful for creating range queries for [`hyperbee`](https://github.com/holepunchto/hyperbee?tab=readme-ov-file#const-stream--dbcreatereadstreamrange-options) based on the index encoder.

The `query` specifies the range you want to read:

```
{
  gt,  // Return values only > than this
  gte, // Return values >= than this
  lt,  // Return values < than this
  lte: // Return values <= than this
}
```

Returned query will be bounded by the `prefix` if defined and the query is unbounded. This ensures ranges only query ranges with the same `prefix`.

#### `const values = idx.decode(buffer)`

Decode the `buffer` into the original values. `values` will be in the same order as the defined `encodings`. Buffers encoded with a subset of keys will return the values encoded with remaining values being `0` filled if encoded with `UNIT` else `null`:

```
const idx = new IndexEncoder([
  IndexEncoder.STRING,
  IndexEncoder.UINT,
  IndexEncoder.STRING
])

const buf = idx.encode(['foo'])
console.log(idx.decode(buf)) // ['foo', 0, null]
```

## Encoding Types

The following are the types for `encodings` are supported provided as static properties on the `IndexEncoder` class:

- `IndexEncoder.BUFFER` : Encodes a buffer.
- `IndexEncoder.STRING` : Encodes a string.
- `IndexEncoder.UINT` : Encodes an unsigned integer.
- `IndexEncoder.BOOL` : Encodes a boolean.

#### `const enc = IndexEncoder.lookup(c)`

Returns the encoding type for a given compact encoding name (`c`). If `c` is not supported, it will throw an `Unknown type` error.

## License

Apache 2.0
