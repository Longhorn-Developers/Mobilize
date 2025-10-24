import React, { ReactNode } from "react";
import { View } from "react-native";

interface EditRouteModal {
  className?: string;
  renderSearchBar: () => ReactNode;
  onExit: () => void;
}

const EditRouteModal = ({
  className,
  renderSearchBar,
  onExit,
}: EditRouteModal) => {
  const handleClose = () => {
    onExit();
  };

  return (
    <>
      {/* Modal View */}
      <View>
        {/* Search Bar */}
        {renderSearchBar && renderSearchBar()}
        {/* Search Results */}
        {/* Choose on Map */}
        {/* Bookmarked Locations */}
      </View>
    </>
  );
};

export default EditRouteModal;
