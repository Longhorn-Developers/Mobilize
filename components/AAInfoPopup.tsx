import { Stack } from "expo-router";
import { useEffect, useState } from "react";
import { useQuery } from "@supabase-cache-helpers/postgrest-react-query";
import { supabase } from "~/utils/supabase";
import { View, Text, TextInput, Modal, Button, StyleSheet } from 'react-native';

//POC

interface AAInfoPopupProps {
  visible: boolean;
  onClose: () => void;
  selectedAAID: string;
  selectedAAName: string;
}

const AAInfoPopup: React.FC<AAInfoPopupProps> = ({
  visible,
  onClose,
  selectedAAID,
  selectedAAName,
}) => {
  return (
    <Modal
      transparent={true}
      animationType="slide"
      visible={visible}
      onRequestClose={onClose}
    >
      <View style={styles.modalContainer}>
        <View style={styles.popup}>
          {selectedAAName && (
            <View>
              <Text>{selectedAAID}</Text>
              <Text>{selectedAAName}</Text>
            </View>
          )}
          <Button title="Exit" onPress={onClose} color="red" />
        </View>
      </View>
    </Modal>
  );
};


export default AAInfoPopup;

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', padding: 20 },
  modalContainer: {
    flex: 1,
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  popup: {
    backgroundColor: 'white',
    marginHorizontal: 30,
    padding: 20,
    borderRadius: 10,
    elevation: 10,
  },
  input: {
    borderBottomWidth: 1,
    marginBottom: 10,
    paddingVertical: 5,
  },
});