// Source - https://stackoverflow.com/q/40694161
// Posted by Neil Simpson
// Retrieved 2026-03-08, License - CC BY-SA 3.0

/**
 * Decodes a Google Encoded Polyline v1 string into an array of [lng, lat] coordinate pairs.
 * See https://developers.google.com/maps/documentation/utilities/polylinealgorithm for the format spec.
 */
export default function decode( value: string ) {

  let values = decode.integers( value )
  let points = []

  for( let i = 0; i < values.length; i += 2 ) {
    points.push([
      ( values[ i + 1 ] += ( values[ i - 1 ] || 0 ) ) / 1e5,
      ( values[ i + 0 ] += ( values[ i - 2 ] || 0 ) ) / 1e5,
    ])
  }

  return points

}

decode.sign = function( value: number ) {
  return value & 1 ? ~( value >>> 1 ) : ( value >>> 1 )
}

decode.integers = function( value: string ) {

  let values = []
  let byte = 0
  let current = 0
  let bits = 0

  for( let i = 0; i < value.length; i++ ) {

    byte = value.charCodeAt( i ) - 63
    current = current | (( byte & 0x1F ) << bits )
    bits = bits + 5

    if( byte < 0x20 ) {
      values.push( decode.sign( current ) )
      current = 0
      bits = 0
    }

  }

  return values

}
