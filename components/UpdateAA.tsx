import { supabase } from "~/utils/supabase";
import { useState, useEffect } from "react";
import { View } from "react-native";
import { useQuery } from "@supabase-cache-helpers/postgrest-react-query";
import { useQueryClient, useMutation } from '@tanstack/react-query';
import { useDeleteMutation } from '@supabase-cache-helpers/postgrest-react-query'
import React from "react";

import { Button } from "~/components/Button";


interface UpdatePopupProps {
  aa_id: string | null;
  onClose: () => void; // callback type
}

const UpdatePopup: React.FC<UpdatePopupProps> = ({ aa_id, onClose }) => {

    
    const {mutateAsync: deleteAA} = useDeleteMutation(
        supabase.from('avoidance_areas'),
        ['id'],
        'id',
        {
            onSuccess: () => console.log("Successfully deleted item ", aa_id)
        }
        
    );
    const handleDeleteAA = async (aa_id:string) => {
        console.log("Attempting to delete AA ", aa_id)
        try {
            await deleteAA({ id: aa_id })
            console.log("Successfully executed deleteAA")
            

            
        } catch (err) {
            console.error("Failed to delete avoidance area:", err)
        }

        onClose();
        
        
    }


    return (
        <View>
            
            <Button
                className="absolute bottom-4 left-4"
                title="Delete"
                onPress = {() => handleDeleteAA(aa_id!)}
            />
            <Button
                className="absolute bottom-20 left-4"
                title="Edit"
            />
            <Button
                className="absolute bottom-36 left-4"
                title="Close"
                onPress = {() => onClose()}
            />


            
        </View>
    );
}

export default UpdatePopup;