import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { FastImage } from '../hooks/useMapIcons';

// Example component showing FastImage capabilities with native builds
const FastImageExample = () => {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>FastImage Examples (Native Build)</Text>
      
      {/* Local bundled map icons */}
      <View style={styles.iconRow}>
        <Text style={styles.label}>Point Icon:</Text>
        <FastImage
          style={styles.icon}
          source={require('../assets/map_icons/point.png')}
          resizeMode={FastImage.resizeMode.contain}
        />
      </View>
      
      <View style={styles.iconRow}>
        <Text style={styles.label}>Auto Door:</Text>
        <FastImage
          style={styles.icon}
          source={require('../assets/map_icons/auto_door.png')}
          resizeMode={FastImage.resizeMode.contain}
        />
      </View>
      
      {/* Remote image with FastImage features */}
      <View style={styles.iconRow}>
        <Text style={styles.label}>Remote Image:</Text>
        <FastImage
          style={styles.icon}
          source={{
            uri: 'https://via.placeholder.com/50x50/FF6B6B/FFFFFF?text=IMG',
            priority: FastImage.priority.high,
            cache: FastImage.cacheControl.immutable,
          }}
          resizeMode={FastImage.resizeMode.cover}
          onLoad={() => console.log('FastImage loaded successfully')}
          onError={() => console.log('FastImage failed to load')}
        />
      </View>
      
      {/* Image with authorization headers */}
      <View style={styles.iconRow}>
        <Text style={styles.label}>Auth Image:</Text>
        <FastImage
          style={styles.icon}
          source={{
            uri: 'https://httpbin.org/image/png',
            headers: { Authorization: 'Bearer token' },
            priority: FastImage.priority.normal,
          }}
          resizeMode={FastImage.resizeMode.contain}
        />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: 20,
    backgroundColor: '#f5f5f5',
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 20,
    textAlign: 'center',
  },
  iconRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 15,
    paddingVertical: 10,
    paddingHorizontal: 15,
    backgroundColor: 'white',
    borderRadius: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 2,
  },
  label: {
    flex: 1,
    fontSize: 16,
    fontWeight: '500',
  },
  icon: {
    width: 50,
    height: 50,
  },
});

export default FastImageExample;
