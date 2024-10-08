import { AudioTrackSelector } from "@/components/AudioTrackSelector";
import { Bitrate, BitrateSelector } from "@/components/BitrateSelector";
import { Chromecast } from "@/components/Chromecast";
import { Text } from "@/components/common/Text";
import {
  currentlyPlayingItemAtom,
  playingAtom,
} from "@/components/CurrentlyPlayingBar";
import { DownloadItem } from "@/components/DownloadItem";
import { Loader } from "@/components/Loader";
import { MoviesTitleHeader } from "@/components/movies/MoviesTitleHeader";
import { ParallaxScrollView } from "@/components/ParallaxPage";
import { PlayButton } from "@/components/PlayButton";
import { NextEpisodeButton } from "@/components/series/NextEpisodeButton";
import { SimilarItems } from "@/components/SimilarItems";
import { SubtitleTrackSelector } from "@/components/SubtitleTrackSelector";
import { apiAtom, userAtom } from "@/providers/JellyfinProvider";
import { getBackdropUrl } from "@/utils/jellyfin/image/getBackdropUrl";
import { getLogoImageUrlById } from "@/utils/jellyfin/image/getLogoImageUrlById";
import { getStreamUrl } from "@/utils/jellyfin/media/getStreamUrl";
import { getUserItemData } from "@/utils/jellyfin/user-library/getUserItemData";
import { chromecastProfile } from "@/utils/profiles/chromecast";
import ios from "@/utils/profiles/ios";
import { getMediaInfoApi } from "@jellyfin/sdk/lib/utils/api";
import { useQuery } from "@tanstack/react-query";
import { Image } from "expo-image";
import { useLocalSearchParams, useNavigation } from "expo-router";
import { useAtom } from "jotai";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ScrollView, View } from "react-native";
import CastContext, {
  PlayServicesState,
  useCastDevice,
  useRemoteMediaClient,
} from "react-native-google-cast";

const page: React.FC = () => {
  const local = useLocalSearchParams();
  const { songId: id } = local as { songId: string };

  const [api] = useAtom(apiAtom);
  const [user] = useAtom(userAtom);

  const [, setPlaying] = useAtom(playingAtom);

  const castDevice = useCastDevice();
  const navigation = useNavigation();

  useEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <View className="">
          <Chromecast />
        </View>
      ),
    });
  });

  const chromecastReady = useMemo(() => !!castDevice?.deviceId, [castDevice]);
  const [selectedAudioStream, setSelectedAudioStream] = useState<number>(-1);
  const [selectedSubtitleStream, setSelectedSubtitleStream] =
    useState<number>(0);
  const [maxBitrate, setMaxBitrate] = useState<Bitrate>({
    key: "Max",
    value: undefined,
  });

  const { data: item, isLoading: l1 } = useQuery({
    queryKey: ["item", id],
    queryFn: async () =>
      await getUserItemData({
        api,
        userId: user?.Id,
        itemId: id,
      }),
    enabled: !!id && !!api,
    staleTime: 60 * 1000,
  });

  const backdropUrl = useMemo(
    () =>
      getBackdropUrl({
        api,
        item,
        quality: 90,
        width: 1000,
      }),
    [item]
  );

  const logoUrl = useMemo(
    () => (item?.Type === "Movie" ? getLogoImageUrlById({ api, item }) : null),
    [item]
  );

  const { data: sessionData } = useQuery({
    queryKey: ["sessionData", item?.Id],
    queryFn: async () => {
      if (!api || !user?.Id || !item?.Id) return null;
      const playbackData = await getMediaInfoApi(api!).getPlaybackInfo({
        itemId: item?.Id,
        userId: user?.Id,
      });

      return playbackData.data;
    },
    enabled: !!item?.Id && !!api && !!user?.Id,
    staleTime: 0,
  });

  const { data: playbackUrl } = useQuery({
    queryKey: [
      "playbackUrl",
      item?.Id,
      maxBitrate,
      castDevice,
      selectedAudioStream,
      selectedSubtitleStream,
    ],
    queryFn: async () => {
      if (!api || !user?.Id || !sessionData) return null;

      const url = await getStreamUrl({
        api,
        userId: user.Id,
        item,
        startTimeTicks: item?.UserData?.PlaybackPositionTicks || 0,
        maxStreamingBitrate: maxBitrate.value,
        sessionData,
        deviceProfile: castDevice?.deviceId ? chromecastProfile : ios,
        audioStreamIndex: selectedAudioStream,
        subtitleStreamIndex: selectedSubtitleStream,
      });

      console.log("Transcode URL: ", url);

      return url;
    },
    enabled: !!sessionData,
    staleTime: 0,
  });

  const [, setCp] = useAtom(currentlyPlayingItemAtom);
  const client = useRemoteMediaClient();

  const onPressPlay = useCallback(
    async (type: "device" | "cast" = "device") => {
      if (!playbackUrl || !item) return;

      if (type === "cast" && client) {
        await CastContext.getPlayServicesState().then((state) => {
          if (state && state !== PlayServicesState.SUCCESS)
            CastContext.showPlayServicesErrorDialog(state);
          else {
            client.loadMedia({
              mediaInfo: {
                contentUrl: playbackUrl,
                contentType: "video/mp4",
                metadata: {
                  type: item.Type === "Episode" ? "tvShow" : "movie",
                  title: item.Name || "",
                  subtitle: item.Overview || "",
                },
              },
              startTime: 0,
            });
          }
        });
      } else {
        setCp({
          item,
          playbackUrl,
        });
        setPlaying(true);
      }
    },
    [playbackUrl, item]
  );

  if (l1)
    return (
      <View className="justify-center items-center h-full">
        <Loader />
      </View>
    );

  if (!item?.Id || !backdropUrl) return null;

  return (
    <ParallaxScrollView
      headerImage={
        <Image
          source={{
            uri: backdropUrl,
          }}
          style={{
            width: "100%",
            height: "100%",
          }}
        />
      }
      logo={
        <>
          {logoUrl ? (
            <Image
              source={{
                uri: logoUrl,
              }}
              style={{
                height: 130,
                width: "100%",
                resizeMode: "contain",
              }}
            />
          ) : null}
        </>
      }
    >
      <View className="flex flex-col px-4 pt-4">
        <View className="flex flex-col">
          <MoviesTitleHeader item={item} />
          <Text className="text-center opacity-50">{item?.ProductionYear}</Text>
        </View>

        <View className="flex flex-row justify-between items-center w-full my-4">
          {playbackUrl ? (
            <DownloadItem item={item} playbackUrl={playbackUrl} />
          ) : (
            <View className="h-12 aspect-square flex items-center justify-center"></View>
          )}
        </View>
      </View>
      <View className="flex flex-col p-4 w-full">
        <View className="flex flex-row items-center space-x-2 w-full">
          <BitrateSelector
            onChange={(val) => setMaxBitrate(val)}
            selected={maxBitrate}
          />
          <AudioTrackSelector
            item={item}
            onChange={setSelectedAudioStream}
            selected={selectedAudioStream}
          />
          <SubtitleTrackSelector
            item={item}
            onChange={setSelectedSubtitleStream}
            selected={selectedSubtitleStream}
          />
        </View>
        <View className="flex flex-row items-center justify-between w-full">
          <NextEpisodeButton item={item} type="previous" className="mr-2" />
          <PlayButton
            item={item}
            chromecastReady={chromecastReady}
            onPress={onPressPlay}
            className="grow"
          />
          <NextEpisodeButton item={item} className="ml-2" />
        </View>
      </View>
      <ScrollView horizontal className="flex px-4 mb-4">
        <View className="flex flex-row space-x-2 ">
          <View className="flex flex-col">
            <Text className="text-sm opacity-70">Audio</Text>
          </View>
          <View className="flex flex-col">
            <Text className="text-sm opacity-70">
              {item.MediaStreams?.find((i) => i.Type === "Audio")?.DisplayTitle}
            </Text>
          </View>
        </View>
      </ScrollView>

      <SimilarItems itemId={item.Id} />

      <View className="h-12"></View>
    </ParallaxScrollView>
  );
};

export default page;
