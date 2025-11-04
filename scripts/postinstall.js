#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

console.log('Applying react-native-maps CMakeLists.txt fix...');

const cmakeFile = path.join(__dirname, '..', 'node_modules', 'react-native-maps', 'android', 'src', 'main', 'jni', 'CMakeLists.txt');

if (!fs.existsSync(cmakeFile)) {
  console.log('CMakeLists.txt not found, skipping patch');
  process.exit(0);
}

let content = fs.readFileSync(cmakeFile, 'utf8');

// Check if already patched
if (content.includes('target_compile_options(react_codegen_RNMapsSpecs PRIVATE')) {
  console.log('✓ Already patched');
  process.exit(0);
}

// Replace the non-existent function with standard CMake function
const oldText = 'target_compile_reactnative_options(react_codegen_RNMapsSpecs PRIVATE)';
const newText = `target_compile_options(react_codegen_RNMapsSpecs PRIVATE
  -DLOG_TAG=\\"ReactNative\\"
  -fexceptions
  -frtti
  -std=c++20
  -Wall
)`;

if (content.includes(oldText)) {
  content = content.replace(oldText, newText);
  fs.writeFileSync(cmakeFile, content, 'utf8');
  console.log('✓ Successfully patched react-native-maps CMakeLists.txt');
} else {
  console.log('⚠ Pattern not found, file may have already been patched or changed');
}

