import React from "react";
import { View } from "react-native";

interface EditRouteModal {
  className?: string;
  onExit: () => void;
}

const EditRouteModal = ({ className, onExit }: EditRouteModal) => {
  const handleClose = () => {
    onExit();
  };

  return (
    <>
      {/* Modal View */}
      <View>
        {/* Search Bar */}
        {/* Search Results */}
        {/* Choose on Map */}
        {/* Bookmarked Locations */}
      </View>
    </>
  );
};

export default EditRouteModal;
