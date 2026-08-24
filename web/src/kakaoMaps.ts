export interface KakaoLatLng {
  getLat: () => number;
  getLng: () => number;
}

export interface KakaoLatLngBounds {
  extend: (position: KakaoLatLng) => void;
}

export interface KakaoMap {
  relayout: () => void;
  setBounds: (
    bounds: KakaoLatLngBounds,
    paddingTop?: number,
    paddingRight?: number,
    paddingBottom?: number,
    paddingLeft?: number,
  ) => void;
}

interface KakaoMapOverlay {
  setMap: (map: KakaoMap | null) => void;
}

export interface KakaoCustomOverlay extends KakaoMapOverlay {
  setPosition: (position: KakaoLatLng) => void;
}

export interface KakaoMapsApi {
  load: (callback: () => void) => void;
  LatLng: new (latitude: number, longitude: number) => KakaoLatLng;
  LatLngBounds: new () => KakaoLatLngBounds;
  Map: new (
    container: HTMLElement,
    options: {
      center: KakaoLatLng;
      level: number;
      draggable?: boolean;
      scrollwheel?: boolean;
    },
  ) => KakaoMap;
  Polyline: new (options: {
    map: KakaoMap;
    path: KakaoLatLng[];
    strokeWeight?: number;
    strokeColor?: string;
    strokeOpacity?: number;
    strokeStyle?: string;
    zIndex?: number;
  }) => KakaoMapOverlay;
  CustomOverlay: new (options: {
    map: KakaoMap;
    position: KakaoLatLng;
    content: HTMLElement;
    xAnchor?: number;
    yAnchor?: number;
    zIndex?: number;
  }) => KakaoCustomOverlay;
}

declare global {
  interface Window {
    kakao?: { maps?: KakaoMapsApi };
  }
}

export class KakaoMapsConfigError extends Error {}

const sdkId = 'spotlog-kakao-maps-sdk';
let sdkPromise: Promise<KakaoMapsApi> | null = null;

export const loadKakaoMaps = () => {
  const javascriptKey = import.meta.env.VITE_KAKAO_MAP_JAVASCRIPT_KEY?.trim();
  if (!javascriptKey) {
    return Promise.reject(new KakaoMapsConfigError('카카오맵 JavaScript 키가 설정되지 않았습니다.'));
  }

  if (window.kakao?.maps) {
    return new Promise<KakaoMapsApi>((resolve) => window.kakao!.maps!.load(() => resolve(window.kakao!.maps!)));
  }
  if (sdkPromise) return sdkPromise;

  sdkPromise = new Promise<KakaoMapsApi>((resolve, reject) => {
    const existingScript = document.getElementById(sdkId) as HTMLScriptElement | null;
    const script = existingScript ?? document.createElement('script');

    const handleLoad = () => {
      const maps = window.kakao?.maps;
      if (!maps) {
        sdkPromise = null;
        reject(new Error('카카오맵 SDK가 올바르게 초기화되지 않았습니다.'));
        return;
      }
      maps.load(() => resolve(maps));
    };
    const handleError = () => {
      sdkPromise = null;
      reject(new Error('카카오맵 SDK를 불러오지 못했습니다.'));
    };

    script.addEventListener('load', handleLoad, { once: true });
    script.addEventListener('error', handleError, { once: true });
    if (!existingScript) {
      script.id = sdkId;
      script.async = true;
      script.src = `https://dapi.kakao.com/v2/maps/sdk.js?appkey=${encodeURIComponent(javascriptKey)}&autoload=false`;
      document.head.appendChild(script);
    }
  });

  return sdkPromise;
};
