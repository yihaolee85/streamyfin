import { BaseItemDto } from "@jellyfin/sdk/lib/generated-client/models";
import { View, ViewProps } from "react-native";
import { Badge } from "./Badge";
import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";

interface Props extends ViewProps {
  item: BaseItemDto;
}

export const Ratings: React.FC<Props> = ({ item }) => {
  return (
    <View className="flex flex-row items-center justify-center mt-2 space-x-2">
      {item.OfficialRating && (
        <Badge text={item.OfficialRating} variant="gray" />
      )}
      {item.CommunityRating && (
        <Badge
          text={item.CommunityRating}
          variant="gray"
          iconLeft={<Ionicons name="star" size={14} color="gold" />}
        />
      )}
      {item.CriticRating && (
        <Badge
          text={item.CriticRating}
          variant="gray"
          iconLeft={
            <Image
              source={require("@/assets/images/rotten-tomatoes.png")}
              style={{
                width: 14,
                height: 14,
              }}
            />
          }
        />
      )}
    </View>
  );
};
