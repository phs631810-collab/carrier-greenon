const OPEN_METEO_URL = "https://api.open-meteo.com/v1/forecast";

// 네트워크나 위치 권한 문제가 있어도 화면을 유지하기 위한 서울 샘플 날씨입니다.
export const sampleWeather = {
  location: "서울",
  temperature: 29,
  humidity: 58,
  weatherCode: 0,
  source: "sample",
  updatedAt: new Date().toISOString(),
};

// WMO 날씨 코드를 교육용 앱에 필요한 간단한 한국어 상태로 바꿉니다.
export function getWeatherLabel(code) {
  if (code === 0) return "맑고 더워요";
  if ([1, 2, 3].includes(code)) return "구름이 있어요";
  if ([45, 48].includes(code)) return "안개가 끼었어요";
  if (code >= 51 && code <= 67) return "비가 내려요";
  if (code >= 71 && code <= 77) return "눈이 내려요";
  if (code >= 80 && code <= 82) return "소나기가 와요";
  if (code >= 95) return "천둥번개가 있어요";
  return "날씨를 확인했어요";
}

// 날씨 조건에 맞는 친환경 냉방 행동을 추천합니다.
export function getWeatherMission(weather) {
  if (weather.humidity >= 70) return { type: "humid", title: "제습 모드로 쾌적함 유지하기", copy: "습도가 높아요. 과도한 온도 설정 대신 제습을 활용해 보세요." };
  if (weather.temperature >= 30) return { type: "hot", title: "26°C 냉방과 선풍기 함께 쓰기", copy: "무더운 날에는 공기를 순환해 냉방 효율을 높여요." };
  return { type: "mild", title: "26°C 적정 온도 유지하기", copy: "지금 날씨에는 적정 온도 유지가 가장 효율적이에요." };
}

// Open-Meteo의 current 응답을 앱에서 쓰는 형태로 정규화합니다.
export async function fetchCurrentWeather({ latitude = 37.5665, longitude = 126.978, location = "서울" } = {}) {
  const params = new URLSearchParams({
    latitude: String(latitude),
    longitude: String(longitude),
    current: "temperature_2m,relative_humidity_2m,weather_code",
    timezone: "auto",
  });
  const response = await fetch(`${OPEN_METEO_URL}?${params}`, { signal: AbortSignal.timeout(7000) });
  if (!response.ok) throw new Error(`날씨 API 응답 오류 (${response.status})`);
  const data = await response.json();
  if (!data.current) throw new Error("현재 날씨 데이터가 없습니다.");
  return {
    location,
    temperature: Math.round(data.current.temperature_2m),
    humidity: Math.round(data.current.relative_humidity_2m),
    weatherCode: data.current.weather_code,
    source: "open-meteo",
    updatedAt: data.current.time || new Date().toISOString(),
  };
}

// 브라우저 위치 권한은 사용자가 허용했을 때만 좌표를 반환합니다.
export function requestCurrentPosition() {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) return reject(new Error("이 브라우저는 위치 기능을 지원하지 않습니다."));
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => resolve({ latitude: coords.latitude, longitude: coords.longitude, location: "현재 위치" }),
      () => reject(new Error("위치 권한이 없어 서울 날씨를 사용합니다.")),
      { enableHighAccuracy: false, timeout: 7000, maximumAge: 600000 },
    );
  });
}
