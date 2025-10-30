/**
 * Hermes polyfills
 * Fixes _toString error in Hermes engine
 * This error occurs when dependencies try to access internal JS engine properties
 */

// Polyfill for _toString (for Hermes compatibility)
// Some libraries may try to access Object.prototype._toString which doesn't exist in Hermes
try {
  // Only add if it doesn't exist and we're in a Hermes environment
  if (typeof global !== 'undefined' && typeof Object.prototype._toString === 'undefined') {
    Object.defineProperty(Object.prototype, '_toString', {
      value: function() {
        return String(this);
      },
      writable: false,
      configurable: true,
      enumerable: false,
    });
  }
} catch (e) {
  // Silently fail if we can't define the property
  // This might happen in strict mode or if Object.prototype is frozen
}

