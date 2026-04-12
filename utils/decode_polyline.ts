// Source - https://stackoverflow.com/q/40694161
// Posted by Neil Simpson
// Retrieved 2026-03-08, License - CC BY-SA 3.0

export default function decode( value: any ) {

  var values = decode.integers( value )
  var points = []

  for( var i = 0; i < values.length; i += 2 ) {
    points.push([
      ( values[ i + 1 ] += ( values[ i - 1 ] || 0 ) ) / 1e5,
      ( values[ i + 0 ] += ( values[ i - 2 ] || 0 ) ) / 1e5,
    ])
  }

  return points

}

decode.sign = function( value: any ) {
  return value & 1 ? ~( value >>> 1 ) : ( value >>> 1 )
}

decode.integers = function( value: any ) {

  var values = []
  var byte = 0
  var current = 0
  var bits = 0

  for( var i = 0; i < value.length; i++ ) {

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
