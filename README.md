# index-encoder

Encode multiple values into sorted keys

```
npm install index-encoder
```

## Usage

``` js
const IndexEncoder = require('index-encoder')

const idx = new IndexEncoder([
  IndexEncoder.STRING,
  IndexEncoder.UINT
])

const buf = idx.encode(['foo', 42])
console.log(idx.decode(buf)) // ['foo', 42]

// pass any compact encoding name to map it to the relevant encoding
const uintType = IndexEncoder.lookup('uint')
const bufferType = IndexEncoder.lookup('buffer')
const alsoBufferType = IndexEncoder.lookup('fixed32')
```

## License

Apache 2.0
