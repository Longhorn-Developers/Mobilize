import React from 'react';
import { View, Text, ScrollView, TouchableOpacity } from 'react-native';

interface ErrorBoundaryState {
  error?: Error;
  errorInfo?: React.ErrorInfo;
}

export default class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  ErrorBoundaryState
> {
  state: ErrorBoundaryState = { error: undefined, errorInfo: undefined };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('=== ERROR BOUNDARY CAUGHT ERROR ===');
    console.error('Error:', error);
    console.error('Error Info:', errorInfo);
    console.error('Stack:', error.stack);
  }

  render() {
    if (this.state.error) {
      return (
        <View style={{ flex: 1, padding: 20, backgroundColor: '#fff' }}>
          <ScrollView>
            <Text style={{ fontSize: 20, fontWeight: 'bold', color: '#bf5700', marginBottom: 10 }}>
              Something went wrong 😢
            </Text>
            <Text style={{ fontSize: 16, marginBottom: 10, color: '#333' }}>
              {this.state.error.toString()}
            </Text>
            <Text style={{ fontSize: 14, color: '#666', marginTop: 10 }}>Stack trace:</Text>
            <Text style={{ fontSize: 12, color: '#999', fontFamily: 'monospace' }}>
              {this.state.error.stack}
            </Text>
            {this.state.errorInfo && (
              <>
                <Text style={{ fontSize: 14, color: '#666', marginTop: 20 }}>Component stack:</Text>
                <Text style={{ fontSize: 12, color: '#999', fontFamily: 'monospace' }}>
                  {this.state.errorInfo.componentStack}
                </Text>
              </>
            )}
            <TouchableOpacity
              style={{
                marginTop: 20,
                padding: 15,
                backgroundColor: '#bf5700',
                borderRadius: 8,
                alignItems: 'center',
              }}
              onPress={() => this.setState({ error: undefined, errorInfo: undefined })}
            >
              <Text style={{ color: '#fff', fontSize: 16, fontWeight: 'bold' }}>Try Again</Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      );
    }

    return this.props.children;
  }
}

