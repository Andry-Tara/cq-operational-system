export type DeviceLocation = {
  latitude: number;
  longitude: number;
  accuracyM: number;
};

export async function getCurrentDeviceLocation():
  Promise<
    DeviceLocation | null
  > {
  if (
    typeof navigator ===
      "undefined" ||
    !navigator.geolocation
  ) {
    return null;
  }

  return new Promise(
    (
      resolve,
    ) => {
      navigator.geolocation.getCurrentPosition(
        (
          position,
        ) => {
          resolve({
            latitude:
              position
                .coords
                .latitude,

            longitude:
              position
                .coords
                .longitude,

            accuracyM:
              position
                .coords
                .accuracy,
          });
        },

        () => {
          resolve(
            null,
          );
        },

        {
          enableHighAccuracy:
            true,

          timeout:
            12_000,

          maximumAge:
            0,
        },
      );
    },
  );
}
