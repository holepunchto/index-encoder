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
```

## License

Apache 2.0
