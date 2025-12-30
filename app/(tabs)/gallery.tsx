import { useState, useCallback } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  Image,
  StyleSheet,
  Dimensions,
  RefreshControl,
  Alert,
} from "react-native";
import { useFocusEffect } from "expo-router";
import { ScreenContainer } from "@/components/screen-container";
import { useColors } from "@/hooks/use-colors";
import AsyncStorage from "@react-native-async-storage/async-storage";

interface PhotoData {
  id: string;
  uri: string;
  timestamp: string;
  location: {
    latitude: number;
    longitude: number;
    accuracy: number | null;
  } | null;
}

const { width } = Dimensions.get("window");
const ITEM_SIZE = (width - 48) / 3; // 3 columns with padding

export default function GalleryScreen() {
  const colors = useColors();
  const [photos, setPhotos] = useState<PhotoData[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedPhoto, setSelectedPhoto] = useState<PhotoData | null>(null);

  const loadPhotos = async () => {
    try {
      const photosJson = await AsyncStorage.getItem("photos");
      if (photosJson) {
        const loadedPhotos: PhotoData[] = JSON.parse(photosJson);
        setPhotos(loadedPhotos);
      } else {
        setPhotos([]);
      }
    } catch (error) {
      console.error("Error loading photos:", error);
    }
  };

  useFocusEffect(
    useCallback(() => {
      loadPhotos();
    }, [])
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await loadPhotos();
    setRefreshing(false);
  };

  const deletePhoto = async (photoId: string) => {
    Alert.alert("Delete Photo", "Are you sure you want to delete this photo?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          const updatedPhotos = photos.filter((p) => p.id !== photoId);
          await AsyncStorage.setItem("photos", JSON.stringify(updatedPhotos));
          setPhotos(updatedPhotos);
          setSelectedPhoto(null);
        },
      },
    ]);
  };

  const renderPhoto = ({ item }: { item: PhotoData }) => (
    <TouchableOpacity
      style={[styles.photoItem, { backgroundColor: colors.surface }]}
      onPress={() => setSelectedPhoto(item)}
    >
      <Image source={{ uri: item.uri }} style={styles.thumbnail} resizeMode="cover" />
    </TouchableOpacity>
  );

  if (selectedPhoto) {
    return (
      <View style={[styles.fullScreenContainer, { backgroundColor: colors.background }]}>
        <Image source={{ uri: selectedPhoto.uri }} style={styles.fullScreenImage} resizeMode="contain" />
        
        {/* Photo Info Overlay */}
        <View style={styles.infoOverlay}>
          <Text style={styles.timestampText}>{selectedPhoto.timestamp}</Text>
          {selectedPhoto.location && (
            <Text style={styles.locationText}>
              {selectedPhoto.location.latitude.toFixed(6)}, {selectedPhoto.location.longitude.toFixed(6)}
            </Text>
          )}
        </View>

        {/* Action Buttons */}
        <View style={styles.actionButtons}>
          <TouchableOpacity
            style={[styles.actionButton, { backgroundColor: "rgba(0,0,0,0.7)" }]}
            onPress={() => setSelectedPhoto(null)}
          >
            <Text style={styles.actionButtonText}>Close</Text>
          </TouchableOpacity>
          
          <TouchableOpacity
            style={[styles.actionButton, { backgroundColor: "rgba(220,38,38,0.9)" }]}
            onPress={() => deletePhoto(selectedPhoto.id)}
          >
            <Text style={styles.actionButtonText}>Delete</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <ScreenContainer className="flex-1">
      {photos.length === 0 ? (
        <View className="flex-1 items-center justify-center p-6">
          <Text className="text-muted text-center text-lg">
            No photos yet. Take your first timestamped photo!
          </Text>
        </View>
      ) : (
        <FlatList
          data={photos}
          renderItem={renderPhoto}
          keyExtractor={(item) => item.id}
          numColumns={3}
          contentContainerStyle={styles.gridContainer}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        />
      )}
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  gridContainer: {
    padding: 8,
  },
  photoItem: {
    width: ITEM_SIZE,
    height: ITEM_SIZE,
    margin: 4,
    borderRadius: 8,
    overflow: "hidden",
  },
  thumbnail: {
    width: "100%",
    height: "100%",
  },
  fullScreenContainer: {
    flex: 1,
  },
  fullScreenImage: {
    flex: 1,
    width: "100%",
    height: "100%",
  },
  infoOverlay: {
    position: "absolute",
    top: 60,
    left: 20,
    right: 20,
    backgroundColor: "rgba(0, 0, 0, 0.7)",
    padding: 12,
    borderRadius: 8,
  },
  timestampText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "bold",
    marginBottom: 4,
  },
  locationText: {
    color: "#CCCCCC",
    fontSize: 14,
  },
  actionButtons: {
    position: "absolute",
    bottom: 40,
    left: 20,
    right: 20,
    flexDirection: "row",
    justifyContent: "space-around",
  },
  actionButton: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
    minWidth: 120,
    alignItems: "center",
  },
  actionButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "600",
  },
});
